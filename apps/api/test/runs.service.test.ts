import { beforeEach, expect, it, vi } from 'vitest';
import { dispatchRun, replay, startRun } from '../src/services/runs.service';
import * as repo from '../src/repositories/runs.repository';
import { loadSchoolActor } from '../src/services/identity.service';
import { makeFakeDeps, makeFakeSchoolGateway } from './support/fake-deps';
import type { SchoolActor } from '@repo/shared';
vi.mock('../src/repositories/runs.repository');
vi.mock('../src/services/identity.service');
const a: SchoolActor = {
  schoolId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  membershipId: crypto.randomUUID(),
  role: 'teacher',
  displayName: 'Synthetic teacher',
  classes: [],
  children: [],
};
const r = {
  id: crypto.randomUUID(),
  schoolId: a.schoolId,
  ownerId: a.ownerId,
  membershipId: a.membershipId,
  role: 'teacher',
  agentId: 'jum',
  classId: null,
  requestId: crypto.randomUUID(),
  prompt: 'worksheet',
  status: 'queued',
  attemptId: null,
  credentialHash: null,
  leaseUntil: new Date(Date.now() + 720000),
  createdAt: new Date(),
} as const;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadSchoolActor).mockResolvedValue(a);
  vi.mocked(repo.claim).mockResolvedValue(r);
  vi.mocked(repo.recentTurns).mockResolvedValue([]);
});
function consumer(body: string, status = 200) {
  const d = makeFakeDeps().deps;
  const fetch = vi.fn(async () => new Response(body, { status }));
  return {
    deps: {
      ...d,
      config: { ...d.config, APP_URL: 'https://app.example.com' },
      agentGateway: makeFakeSchoolGateway(fetch),
    },
    fetch,
  };
}
it('skips a repeated queue message and interrupts an acknowledged stream without completion', async () => {
  const { deps, fetch } = consumer('data: {"type":"delta","text":"partial"}\n\n');
  vi.mocked(repo.claim).mockResolvedValueOnce(r).mockResolvedValueOnce(undefined);
  await dispatchRun(deps, r.id);
  await dispatchRun(deps, r.id);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(repo.append).toHaveBeenCalledWith(deps.db, r.id, expect.any(String), [
    { type: 'delta', text: 'partial' },
  ]);
  expect(repo.finish).toHaveBeenCalledWith(deps.db, r.id, expect.any(String), 'interrupted', {
    type: 'error',
    code: 'interrupted',
  });
});
it('preserves message boundaries and reclassifies interim replies without adding a wire event kind', async () => {
  const frames = [
    { type: 'delta', text: 'รอ', messageId: 'draft' },
    { type: 'delta', text: 'สักครู่', messageId: 'draft' },
    { type: 'delta', text: 'ข้อ 1', messageId: 'answer' },
    { type: 'progress', messageId: 'draft' },
    { type: 'delta', text: ' ได้ 4', messageId: 'answer' },
    { type: 'done', elapsedMs: 100 },
  ];
  const { deps } = consumer(
    frames.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''),
  );
  await dispatchRun(deps, r.id);
  expect(repo.append).toHaveBeenCalledWith(deps.db, r.id, expect.any(String), [
    { type: 'delta', text: 'รอสักครู่', messageId: 'draft' },
    { type: 'delta', text: 'ข้อ 1', messageId: 'answer' },
    { type: 'delta', text: '', messageId: 'draft', interim: true },
    { type: 'delta', text: ' ได้ 4', messageId: 'answer' },
  ]);
});
it('denies a different class and principal agent before reservation and rejects request ID conflicts', async () => {
  const { deps } = consumer('');
  const input = { prompt: r.prompt, clientRequestId: r.requestId };
  await expect(
    startRun(deps, a, 'jum', { ...input, classId: crypto.randomUUID() }),
  ).rejects.toMatchObject({ code: 'forbidden' });
  await expect(startRun(deps, a, 'rungchao', input)).rejects.toMatchObject({ code: 'forbidden' });
  expect(repo.accept).not.toHaveBeenCalled();
  vi.mocked(repo.accept).mockResolvedValue(r);
  await expect(startRun(deps, a, 'jum', { ...input, prompt: 'changed' })).rejects.toMatchObject({
    code: 'conflict',
  });
});
it('requires continued membership before dispatch and ownership before replay', async () => {
  const { deps, fetch } = consumer('');
  vi.mocked(loadSchoolActor).mockRejectedValueOnce(new Error('expired'));
  await dispatchRun(deps, r.id);
  expect(fetch).not.toHaveBeenCalled();
  await expect(replay(deps, a, r.id, 0)).rejects.toMatchObject({ code: 'not_found' });
  expect(repo.events).not.toHaveBeenCalled();
});
it('maps gateway capacity exhaustion and provider errors to terminal events', async () => {
  const limited = consumer('quota', 429);
  await dispatchRun(limited.deps, r.id);
  expect(repo.finish).toHaveBeenCalledWith(limited.deps.db, r.id, expect.any(String), 'failed', {
    type: 'error',
    code: 'capacity_exhausted',
  });
  const timeout = consumer('data: {"type":"error","code":"timeout"}\n\n');
  await dispatchRun(timeout.deps, r.id);
  expect(repo.finish).toHaveBeenCalledWith(timeout.deps.db, r.id, expect.any(String), 'failed', {
    type: 'error',
    code: 'timeout',
  });
});
it('sends the recent turns of the same room with the new prompt so the agent does not ask again', async () => {
  vi.mocked(repo.recentTurns).mockResolvedValue([
    { prompt: 'กำลังจะสอน ป.4/1 เตรียมสอนให้หน่อย', reply: 'เตรียมแผนเศษส่วน ป.4/1 แล้วค่ะ' },
  ]);
  const { deps, fetch } = consumer(
    'data: ' + JSON.stringify({ type: 'done', elapsedMs: 1 }) + '\n\n',
  );
  await dispatchRun(deps, r.id);
  const [, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
  const text = JSON.parse(String(init.body)).text as string;
  expect(text).toContain('ครู: กำลังจะสอน ป.4/1 เตรียมสอนให้หน่อย');
  expect(text).toContain('ผู้ช่วย: เตรียมแผนเศษส่วน ป.4/1 แล้วค่ะ');
  expect(text.endsWith('ข้อความใหม่จากครู:\nworksheet')).toBe(true);
});
it('sends only the prompt when the history lookup fails', async () => {
  vi.mocked(repo.recentTurns).mockRejectedValue(new Error('db'));
  const { deps, fetch } = consumer(
    'data: ' + JSON.stringify({ type: 'done', elapsedMs: 1 }) + '\n\n',
  );
  await dispatchRun(deps, r.id);
  const [, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
  expect(JSON.parse(String(init.body)).text).toBe('worksheet');
});
