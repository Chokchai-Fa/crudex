import { expect, it, vi } from 'vitest';
import { jaew } from '../src/agents/jaew';
import { jeng } from '../src/agents/jeng';
import type { Host } from '../src/harness';
import { directlyRequestsKahoot } from '../src/kahoot-handoff';
import { createTurnRunner } from '../src/run';

const uuid = '2934c5dc-821e-4aaf-9cbf-b6a02427f626';
const childId = 'ses_jeng_private_example';
const title = 'พีทาโกรัส';
const editorUrl = 'https://create.kahoot.it/creator/' + uuid;
const event = (type: string, sessionID: string, data = {}) => ({
  type,
  data: { sessionID, ...data },
});
const output = (value: unknown) => [{ type: 'text', text: JSON.stringify(value) }];

it.each([
  ['ช่วยสร้างเกมใน Kahoot เรื่องพีทาโกรัส', true],
  ['น้องแจ๋ว ขอ Kahoot 3 ข้อ', true],
  ['ทำ Kahoot จากใบงานที่เพิ่งทำค่ะ', true],
  ['ไม่ต้องสร้าง Kahoot', false],
  ['ทำใบงานจากเกม Kahoot เดิม', false],
  ['สร้าง Kahoot และทำใบงานด้วย', false],
  ['ขอวิธีสร้าง Kahoot', false],
  ['บทสนทนาก่อนหน้า: สร้าง Kahoot\nข้อความใหม่จากครู:\nขอบคุณค่ะ', false],
])('routes only a direct Kahoot request (%s)', (text, direct) => {
  expect(directlyRequestsKahoot(text)).toBe(direct);
});

it.each([
  { receipt: 'created', status: 'created', connected: true, rootFirst: true },
  { receipt: 'created', status: 'created', connected: true, rootFirst: false },
  { direct: true, receipt: 'created', status: 'created', connected: true, rootFirst: false },
  { direct: true, receipt: 'none', status: 'connect_required', connected: false, rootFirst: false },
  {
    direct: true,
    receipt: 'execution_failed',
    status: 'failed',
    connected: true,
    rootFirst: false,
  },
  { receipt: 'structured', status: 'created', connected: true, rootFirst: true },
  { receipt: 'auth_error', status: 'connect_required', connected: undefined, rootFirst: true },
  { receipt: 'error', status: 'failed', connected: true, rootFirst: true },
  { receipt: 'none', status: 'connect_required', connected: false, rootFirst: true },
  { receipt: 'none', status: 'failed', connected: undefined, rootFirst: true },
])('separates the Kahoot result from Jaew ($status, root first = $rootFirst)', async (test) => {
  const rootDone = event('session.execution.succeeded', 'root');
  const childReply = 'พี่เจ๋งรายงานรายละเอียดของงาน คำถามและตัวเลือกตัวอย่าง';
  const direct = 'direct' in test && test.direct;
  const text = direct
    ? 'ช่วยสร้างเกมใน Kahoot เรื่อง' + title + ' ห้อง ม.2/1 จำนวน 3 ข้อ'
    : 'เอาตัวเลือกเกมที่คุยกันค่ะ';
  const host = {
    session: {
      create: vi.fn(async (input) =>
        input.parentID ? { id: childId, agent: 'jeng', parentID: 'root' } : { id: 'root' },
      ),
      get: async () => ({ parentID: 'root', agent: 'jeng' }),
      prompt: vi.fn(),
    },
    event: {
      async *subscribe() {
        yield { type: 'server.connected', data: {} };
        if (!direct) {
          yield event('session.tool.input.started', 'root', {
            id: childId + '-delegate',
            name: 'subagent',
          });
          yield event('session.tool.called', 'root', {
            id: childId + '-delegate',
            input: { agent: 'jeng', prompt: 'สร้าง Kahoot เรื่อง' + title },
          });
          yield event('session.tool.success', 'root', {
            id: childId + '-delegate',
            metadata: { sessionID: childId },
          });
          yield event('session.text.delta', 'root', {
            assistantMessageID: 'unsupported-claim',
            delta: 'พี่สร้างเกม Kahoot พีทาโกรัส เรียบร้อยแล้วครับ https://example.test/ปลอม',
          });
          if (test.rootFirst) yield rootDone;
        }
        yield event('session.step.started', childId, { assistantMessageID: 'jeng-message' });
        if (test.receipt !== 'none' && test.receipt !== 'execution_failed') {
          yield event('session.tool.input.started', childId, {
            id: childId + '-create',
            name: 'crudex_kahoot_create_or_update_kahoot',
          });
          yield test.receipt === 'auth_error'
            ? event('session.tool.failed', childId, {
                id: childId + '-create',
                error: { message: 'kahoot_not_connected' },
              })
            : event('session.tool.success', childId, {
                id: childId + '-create',
                content:
                  test.receipt === 'structured'
                    ? [{ type: 'text', text: 'Kahoot draft created' }]
                    : output({ error: test.receipt === 'error', kahoot: { uuid, title } }),
                metadata:
                  test.receipt === 'structured'
                    ? { crudexKahoot: { kahoot: { uuid, title } } }
                    : undefined,
              });
        }
        if (test.status === 'created') {
          yield event('session.tool.input.started', childId, {
            id: childId + '-editor',
            name: 'crudex_kahoot_get_kahoot_editor_url',
          });
          yield event('session.tool.called', childId, { id: childId + '-editor', input: { uuid } });
          yield event('session.tool.success', childId, {
            id: childId + '-editor',
            content: output({ url: editorUrl }),
          });
        }
        if (test.receipt === 'execution_failed') {
          yield event('session.execution.failed', childId);
        } else {
          yield event('session.text.ended', childId, { text: childReply });
          yield event('session.execution.succeeded', childId);
        }
        if (!direct && !test.rootFirst) yield rootDone;
      },
    },
  };
  const events = [];
  for await (const item of createTurnRunner(host as unknown as Host)({
    agent: jaew,
    directory: '.',
    loginId: 'sample-teacher',
    text,
    signal: new AbortController().signal,
    school: true,
    kahootConnected: test.connected,
  })) {
    events.push(item);
  }
  const report = events.filter(({ type }) => type === 'delegated_kahoot');
  expect(report).toEqual([
    {
      type: 'delegated_kahoot',
      agentId: 'jeng',
      childSessionId: childId,
      status: test.status,
      text: test.status === 'created' ? childReply + '\n' + editorUrl : expect.any(String),
      ...(test.status === 'created' ? { kahootId: uuid, title, editorUrl } : {}),
    },
  ]);
  expect(JSON.stringify(events.filter(({ type }) => type !== 'delegated_kahoot'))).not.toContain(
    childId,
  );
  expect(
    events.filter(
      (item) => item.type === 'tool' && item.name === 'subagent' && item.agentId === 'jeng',
    ),
  ).toHaveLength(2);
  const reply = events.flatMap((item) => (item.type === 'delta' ? [item.text] : [])).join('');
  expect(reply).not.toContain(childReply);
  expect(reply).not.toContain('พี่สร้างเกม Kahoot');
  expect(reply).not.toContain('example.test');
  expect(reply).not.toContain(uuid);
  expect(reply).not.toContain(editorUrl);
  if (test.status === 'created') {
    expect(reply).toContain('พี่เจ๋งตอบมาแล้วค่ะ เกม Kahoot เรื่องพีทาโกรัสสร้างเสร็จแล้ว');
    expect(reply).toContain('แชตพี่เจ๋ง');
  } else {
    expect(reply).not.toContain('ให้แล้วค่ะ');
    expect(reply).toContain(test.status === 'connect_required' ? 'เชื่อมบัญชี' : 'ยังสร้าง');
  }
  expect(events.at(-1)?.type).toBe('done');
  expect(host.session.prompt).toHaveBeenCalledTimes(1);
  if (direct) {
    expect(host.session.create).toHaveBeenCalledTimes(2);
    expect(host.session.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        parentID: 'root',
        agent: 'jeng',
        model: { providerID: 'openai', id: jeng.model },
      }),
      expect.anything(),
    );
    expect(host.session.prompt).toHaveBeenCalledWith(
      {
        sessionID: childId,
        text: expect.stringContaining(text),
      },
      expect.anything(),
    );
    const activity = events.filter((item) => item.type === 'tool' && item.agentId === 'jeng');
    expect(activity).toEqual([
      { type: 'tool', name: 'subagent', id: 'delegation:1', agentId: 'jeng', status: 'started' },
      {
        type: 'tool',
        name: 'subagent',
        id: 'delegation:1',
        agentId: 'jeng',
        status: test.receipt === 'execution_failed' ? 'failed' : 'success',
      },
      ...(test.receipt === 'execution_failed'
        ? []
        : [
            {
              type: 'tool',
              name: 'subagent_return',
              id: 'delegation:1',
              agentId: 'jeng',
              status: 'success',
            },
          ]),
    ]);
  }
});
