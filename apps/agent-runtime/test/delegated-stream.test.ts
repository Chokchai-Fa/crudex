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
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'wait',
            ordinal: 0,
            delta: 'รอผลก่อนนะครับ',
          });
          yield event('session.text.ended', 'root', {
            assistantMessageID: 'wait',
            ordinal: 0,
            text: 'รอผลก่อนนะครับ',
          });
          yield event('session.tool.input.started', 'root', { id: 'delegate', name: 'subagent' });
          yield event('session.tool.success', 'root', {
            id: 'delegate',
            metadata: { sessionID: 'child' },
          });
          yield event('session.step.ended', 'root', {
            assistantMessageID: 'wait',
            finish: rootFirst ? 'stop' : 'tool-calls',
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
          yield event('session.text.ended', 'child', {
            assistantMessageID: 'child-answer',
            ordinal: 0,
            text: 'ใบงานพร้อมแล้ว',
          });
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
    expect(events.filter(({ type }) => type === 'delta' || type === 'progress')).toEqual([
      { type: 'delta', messageId: 'wait', text: 'รอผลก่อนนะครับ' },
      { type: 'progress', messageId: 'wait' },
      { type: 'delta', messageId: 'reply:child', text: '\n\nใบงานพร้อมแล้ว' },
      { type: 'delta', messageId: 'reply:child', text: '\n' + formUrl },
    ]);
    expect(events.findIndex(({ type }) => type === 'progress')).toBeLessThan(
      events.findIndex((item) => item.type === 'tool' && item.id === 'publish'),
    );
    expect(events.flatMap((item) => (item.type === 'delta' ? [item.text] : [])).join('')).toBe(
      'รอผลก่อนนะครับ\n\nใบงานพร้อมแล้ว\n' + formUrl,
    );
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
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'answer',
            ordinal: 0,
            delta: 'ส่งสรุปแล้วครับ',
          });
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
          yield event('session.text.ended', 'current', {
            assistantMessageID: 'score-report',
            ordinal: 0,
            text: 'RAW_SCORES',
          });
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
          yield event('session.step.started', 'root', { assistantMessageID: 'continuation' });
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
    expect(events.filter(({ type }) => type === 'delta' || type === 'progress')).toEqual([
      { type: 'delta', messageId: 'wait', text: 'รอผล' },
      { type: 'delta', messageId: 'wait', text: 'ก่อนนะครับ' },
      { type: 'progress', messageId: 'wait' },
      { type: 'delta', messageId: 'menu', text: '\n\nม.2/1 ควรฝึกตัวส่วน เลือกใบงาน' },
      { type: 'progress', messageId: 'menu' },
      { type: 'delta', messageId: 'continuation', text: 'หรือเกมได้' },
    ]);
    expect(prompt).toHaveBeenCalledTimes(1);
  },
);

it.each(['stop', 'length'])(
  'keeps a single answer with finish %s in the answer stream',
  async (finish) => {
    const host = {
      session: { create: async () => ({ id: 'root' }), prompt: vi.fn() },
      event: {
        async *subscribe() {
          yield { type: 'server.connected', data: {} };
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'answer',
            ordinal: 0,
            delta: 'สวัสดีครับ',
          });
          yield event('session.text.ended', 'root', {
            assistantMessageID: 'answer',
            ordinal: 0,
            text: 'สวัสดีครับ',
          });
          yield event('session.step.ended', 'root', { assistantMessageID: 'answer', finish });
          yield event('session.execution.succeeded', 'root');
        },
      },
    };
    const events = [];
    for await (const item of createTurnRunner(host as unknown as Host)({
      agent: jaew,
      directory: '.',
      loginId: 'teacher',
      text: 'สวัสดี',
      signal: new AbortController().signal,
    }))
      events.push(item);
    expect(events.filter(({ type }) => type === 'delta' || type === 'progress')).toEqual([
      { type: 'delta', messageId: 'answer', text: 'สวัสดีครับ' },
    ]);
    expect(events.at(-1)?.type).toBe('done');
  },
);

it('marks pre-tool text while the tool runs and keeps the worksheet and final reply as answers', async () => {
  const host = {
    session: { create: async () => ({ id: 'root' }), prompt: vi.fn() },
    event: {
      async *subscribe() {
        yield { type: 'server.connected', data: {} };
        yield event('session.text.delta', 'root', {
          assistantMessageID: 'wait',
          ordinal: 0,
          delta: 'กำลังสร้างใบงานครับ',
        });
        yield event('session.text.ended', 'root', {
          assistantMessageID: 'wait',
          ordinal: 0,
          text: 'กำลังสร้างใบงานครับ',
        });
        yield event('session.tool.input.started', 'root', {
          assistantMessageID: 'wait',
          id: 'form',
          name: 'fraction_addition_form',
        });
        yield event('session.tool.called', 'root', {
          assistantMessageID: 'wait',
          id: 'form',
          input: {},
          executed: false,
        });
        yield event('session.step.streamed', 'root', { assistantMessageID: 'wait' });
        yield event('session.tool.success', 'root', {
          id: 'form',
          content: [
            { type: 'text', text: JSON.stringify({ mode: 'school', worksheet: 'ใบงาน', formUrl }) },
            { type: 'text', text: JSON.stringify({ mode: 'school', worksheet: 'ใบงานสำรอง' }) },
          ],
        });
        yield event('session.step.ended', 'root', {
          assistantMessageID: 'wait',
          finish: 'tool-calls',
        });
        yield event('session.step.started', 'root', { assistantMessageID: 'answer' });
        yield event('session.text.delta', 'root', {
          assistantMessageID: 'answer',
          ordinal: 0,
          delta: 'ใบงานพร้อมแล้วครับ',
        });
        yield event('session.text.ended', 'root', {
          assistantMessageID: 'answer',
          ordinal: 0,
          text: 'ใบงานพร้อมแล้วครับ',
        });
        yield event('session.step.ended', 'root', { assistantMessageID: 'answer', finish: 'stop' });
        yield event('session.execution.succeeded', 'root');
      },
    },
  };
  const events = [];
  for await (const item of createTurnRunner(host as unknown as Host)({
    agent: jaew,
    directory: '.',
    loginId: 'teacher',
    text: 'ขอใบงาน',
    signal: new AbortController().signal,
  }))
    events.push(item);
  expect(events.filter(({ type }) => type === 'delta' || type === 'progress')).toEqual([
    { type: 'delta', messageId: 'wait', text: 'กำลังสร้างใบงานครับ' },
    { type: 'progress', messageId: 'wait' },
    { type: 'delta', messageId: 'worksheet:' + formUrl, text: '\n\nใบงาน\n\n' },
    { type: 'delta', messageId: 'worksheet:1', text: '\n\nใบงานสำรอง\n\n' },
    { type: 'delta', messageId: 'answer', text: 'ใบงานพร้อมแล้วครับ' },
  ]);
  expect(events.at(-1)?.type).toBe('done');
});
