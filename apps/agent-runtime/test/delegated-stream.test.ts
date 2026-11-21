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

it.each([true, false])(
  'keeps Jaew subscribed for the lesson menu (initial root ends first = %s)',
  async (rootFirst) => {
    const rootEnd = event('session.execution.succeeded', 'root');
    const report = (childID: string, inboxID: string) =>
      event('session.inbox.enqueued', 'root', {
        inboxID,
        item: {
          type: 'synthetic',
          payload: {
            metadata: { source: 'subagent', agent: 'น้องนุ่น', state: 'completed', childID },
          },
        },
      });
    const prompt = vi.fn();
    const host = {
      session: {
        create: async () => ({ id: 'root' }),
        get: async () => ({ agent: 'nun', parentID: 'root' }),
        prompt,
      },
      event: {
        async *subscribe() {
          yield { type: 'server.connected', data: {} };
          yield event('session.tool.input.started', 'root', { name: 'skill', id: 'skill' });
          yield event('session.tool.called', 'root', { id: 'skill', input: { id: 'lesson-prep' } });
          yield event('session.tool.success', 'root', { id: 'skill', content: [] });
          yield event('session.tool.input.started', 'root', { name: 'subagent', id: 'delegate' });
          yield event('session.tool.success', 'root', {
            id: 'delegate',
            metadata: { sessionID: 'current' },
            content: [],
          });
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'wait',
            ordinal: 0,
            delta: 'รอผล',
          });
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'wait',
            ordinal: 0,
            delta: 'ก่อนนะครับ',
          });
          yield event('session.text.ended', 'root', {
            assistantMessageID: 'wait',
            ordinal: 0,
            text: 'รอผลก่อนนะครับ',
          });
          if (rootFirst) yield rootEnd;
          yield event('session.text.ended', 'current', { text: 'RAW_SCORES' });
          yield event('session.execution.succeeded', 'current');
          yield report('old', 'notice-1');
          yield event('session.inbox.delivered', 'root', { inboxID: 'notice-1' });
          if (!rootFirst) yield rootEnd;
          yield report('current', 'notice-2');
          yield event('session.execution.started', 'root');
          yield event('session.inbox.delivered', 'root', { inboxID: 'notice-2' });
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'menu',
            ordinal: 0,
            delta: 'ม.2/1 ควรฝึกตัวส่วน เลือกใบงาน',
          });
          yield event('session.text.ended', 'root', {
            assistantMessageID: 'menu',
            ordinal: 0,
            text: 'ม.2/1 ควรฝึกตัวส่วน เลือกใบงาน',
          });
          yield event('session.step.ended', 'root', {
            assistantMessageID: 'menu',
            finish: 'length',
          });
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'continuation',
            ordinal: 0,
            delta: 'หรือเกมได้',
          });
          yield rootEnd;
        },
      },
    };
    const events = [];
    for await (const item of createTurnRunner(host as unknown as Host)({
      agent: jaew,
      directory: '.',
      loginId: 'teacher',
      text: 'เตรียมสอน',
      signal: new AbortController().signal,
    }))
      events.push(item);
    expect(events.at(-1)?.type).toBe('done');
    expect(events.flatMap((x) => (x.type === 'delta' ? [x.text] : []))).toEqual([
      'รอผล',
      'ก่อนนะครับ',
      '\n\nม.2/1 ควรฝึกตัวส่วน เลือกใบงาน',
      'หรือเกมได้',
    ]);
    expect(prompt).toHaveBeenCalledTimes(1);
  },
);
