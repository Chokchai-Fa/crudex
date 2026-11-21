import { createExecutionContext, createMessageBatch, getQueueResult } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createQueueHandler, MAX_ATTEMPTS } from '../src/jobs/queue-handler';
import worker from '../src/index';
import { makeFakeDeps, makeFakeSchoolGateway } from './support/fake-deps';

const QUEUE = 'crudex-jobs';

function noteJob(id: string, attempts: number) {
  return createMessageBatch(QUEUE, [
    {
      id,
      timestamp: new Date(),
      attempts,
      body: { type: 'note-created', noteId: crypto.randomUUID() },
    },
  ]);
}

it('acks valid and invalid (poison) messages', async () => {
  const batch = createMessageBatch(QUEUE, [
    {
      id: 'valid',
      timestamp: new Date(),
      attempts: 1,
      body: { type: 'ping', sentAt: new Date().toISOString() },
    },
    { id: 'invalid', timestamp: new Date(), attempts: 1, body: { type: 'unknown' } },
  ]);
  const ctx = createExecutionContext();
  await worker.queue(batch, { ...env, SCHOOL_GATEWAY: makeFakeSchoolGateway() }, ctx);
  const result = await getQueueResult(batch, ctx);
  expect(result.explicitAcks.sort()).toEqual(['invalid', 'valid']);
  expect(result.retryMessages).toEqual([]);
});

describe('failing jobs', () => {
  // A job runner that always fails, to exercise the retry rules.
  const handler = createQueueHandler(
    () => makeFakeDeps().deps,
    async () => {
      throw new Error('downstream unavailable');
    },
  );

  it('retries with backoff while attempts remain', async () => {
    const batch = noteJob('retry-me', 2);
    const ctx = createExecutionContext();
    await handler(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toEqual([]);
    expect(result.retryMessages).toEqual([{ msgId: 'retry-me' }]);
  });

  it('acks (gives up) after the last attempt', async () => {
    const batch = noteJob('last-try', MAX_ATTEMPTS);
    const ctx = createExecutionContext();
    await handler(batch, env, ctx);
    const result = await getQueueResult(batch, ctx);
    expect(result.explicitAcks).toEqual(['last-try']);
    expect(result.retryMessages).toEqual([]);
  });
});
