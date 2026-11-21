import { expect, it, vi } from 'vitest';
import { jaew } from '../src/agents/jaew';
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
