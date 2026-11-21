import { expect, it, vi } from 'vitest';
import { jaew } from '../src/agents/jaew';
import { rungchao } from '../src/agents/rungchao';
import type { Host } from '../src/harness';
import { createTurnRunner } from '../src/run';

const formUrl = 'https://docs.google.com/forms/d/e/sample/viewform';
const event = (type: string, sessionID: string, data = {}) => ({
  type,
  data: { sessionID, ...data },
});

it.each([true, false])(
  'joins child completion without submitting another prompt (root first = %s)',
  async (rootFirst) => {
    const rootDone = event('session.execution.succeeded', 'root');
    const host = {
      session: {
        create: vi.fn(async () => ({ id: 'root' })),
        get: vi.fn(async () => ({ parentID: 'root' })),
        prompt: vi.fn(),
      },
      event: {
        async *subscribe() {
          yield { type: 'server.connected', data: {} };
          yield event('session.tool.input.started', 'root', { id: 'delegate', name: 'subagent' });
          yield event('session.tool.success', 'root', {
            id: 'delegate',
            metadata: { sessionID: 'child' },
          });
          if (rootFirst) yield rootDone;
          yield event('session.tool.input.started', 'child', {
            id: 'publish',
            name: 'save_assessment',
          });
          yield event('session.tool.success', 'child', {
            id: 'publish',
            content: [{ type: 'text', text: JSON.stringify({ mode: 'apps-script', formUrl }) }],
          });
          yield event('session.text.ended', 'child', { text: 'ใบงานพร้อมแล้ว' });
          yield event('session.execution.succeeded', 'child');
          if (!rootFirst) yield rootDone;
        },
      },
    };
    const stream = createTurnRunner(host as unknown as Host)({
      agent: jaew,
      directory: '.',
      loginId: '5a75086c-0ab7-4b8d-841a-475f3fa239aa',
      text: 'ขอใบงาน',
      signal: new AbortController().signal,
    });
    const events = [];
    for await (const item of stream) events.push(item);
    expect(events.at(-1)?.type).toBe('done');
    const answer = events.flatMap((item) => (item.type === 'delta' ? [item.text] : [])).join('');
    expect(answer).toContain('ใบงานพร้อมแล้ว');
    expect(answer).toContain(formUrl);
    expect(host.session.prompt).toHaveBeenCalledTimes(1);
  },
);

it.each([rungchao, jaew])(
  'emits published briefs only for the principal root session ($id)',
  async (agent) => {
    const receipt = { briefId: 'brief-example', text: 'งบระดับโรงเรียนใช้ไป 20%' };
    const host = {
      session: {
        create: async () => ({ id: 'root' }),
        get: async () => ({ parentID: 'root' }),
        prompt: vi.fn(),
      },
      event: {
        async *subscribe() {
          yield { type: 'server.connected', data: {} };
          for (const source of ['child', 'root']) {
            yield event('session.tool.input.started', source, {
              name: 'publish_brief',
              id: 'publish',
            });
            yield event('session.tool.success', source, {
              id: 'publish',
              content: [{ type: 'text', text: JSON.stringify(receipt) }],
            });
          }
          yield event('session.text.delta', 'root', { delta: 'ส่งสรุปแล้วครับ' });
          yield event('session.execution.succeeded', 'root');
        },
      },
    };
    const artifacts = [];
    for await (const item of createTurnRunner(host as unknown as Host)({
      agent,
      directory: '.',
      loginId: '5a75086c-0ab7-4b8d-841a-475f3fa239aa',
      text: 'สรุปเช้า',
      signal: new AbortController().signal,
    })) {
      if (item.type === 'principal_brief') artifacts.push(item);
    }
    expect(artifacts).toEqual(
      agent.id === 'rungchao' ? [{ type: 'principal_brief', ...receipt }] : [],
    );
  },
);
