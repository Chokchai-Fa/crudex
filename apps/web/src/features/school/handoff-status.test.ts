import { expect, it } from 'vitest';
import type { RunEvent } from '@repo/shared';
import { jaewHandoffLine, runHandoffs } from './handoff-status';

const jeng: RunEvent = {
  type: 'tool',
  name: 'subagent',
  id: 'delegation:1',
  agentId: 'jeng',
  status: 'started',
};
const jum: RunEvent = { ...jeng, id: 'delegation:2', agentId: 'jum' };
const start: RunEvent[] = [jeng, jum];

it('tracks named recipients independently through start and completion', () => {
  expect(runHandoffs(start)).toEqual([
    { handoffId: jeng.id, agentId: 'jeng', status: 'started' },
    { handoffId: jum.id, agentId: 'jum', status: 'started' },
  ]);
  expect(
    runHandoffs([
      ...start,
      { ...jeng, status: 'success', agentId: undefined },
      { ...jum, status: 'failed' },
      { type: 'done', elapsedMs: 123 },
    ]),
  ).toEqual([
    { handoffId: jeng.id, agentId: 'jeng', status: 'success' },
    { handoffId: jum.id, agentId: 'jum', status: 'failed' },
  ]);
});

it('reports a real return only when the same assignment ID and recipient match', () => {
  const finished: RunEvent[] = [...start, { ...jeng, status: 'success' }];
  const reply: RunEvent = { ...jeng, name: 'subagent_return', status: 'success' };
  expect(runHandoffs([...finished, { ...reply, id: 'unknown' }])).toEqual(runHandoffs(finished));
  expect(runHandoffs([...finished, { ...reply, agentId: 'jum' }])).toEqual(runHandoffs(finished));
  expect(runHandoffs([...finished, reply, { ...jeng, status: 'success' }])).toEqual([
    { handoffId: jeng.id, agentId: 'jeng', status: 'returned' },
    { handoffId: jum.id, agentId: 'jum', status: 'started' },
  ]);
});

it('does not use assistant prose as a handoff or return event', () => {
  expect(runHandoffs([{ type: 'delta', text: 'พี่เจ๋งรับงานและส่งกลับแล้ว' }])).toEqual([]);
});

it('shows a single dispatch and updates that line when Jaew receives the result', () => {
  const finish: RunEvent = { ...jeng, status: 'success' };
  const reply: RunEvent = { ...finish, name: 'subagent_return' };
  const labels = (events: RunEvent[]) =>
    runHandoffs(events).map(({ status }) => jaewHandoffLine('พี่เจ๋ง', status));
  expect(labels([jeng, jeng])).toEqual(['แจ๋วส่งงานให้พี่เจ๋งแล้ว']);
  expect(labels([jeng, finish])).toEqual(['พี่เจ๋งทำงานเสร็จแล้ว']);
  expect(labels([jeng, finish, reply, reply])).toEqual(['พี่เจ๋งตอบมาแล้วค่ะ']);
});
