import { afterEach, expect, it, vi } from 'vitest';
import { MorningBrief, nextMorning, readBrief } from '../src/morning-brief';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));

const frame = (data: object) => 'data: ' + JSON.stringify(data) + '\n\n';
const response = (text: string) => frame({ type: 'delta', text }) + frame({ type: 'done' });

afterEach(() => vi.useRealTimers());

it('accepts complete brief and rejects overlong, incomplete and identifying output', () => {
  expect(readBrief(response('ภาพรวมของห้องตัวอย่าง'))).toBe('ภาพรวมของห้องตัวอย่าง');
  for (const stream of [
    response(Array(8).fill('ห้องตัวอย่าง').join('\n')),
    response('นักเรียนตัวอย่าง 01'),
    response('s-01 คะแนน 8'),
    response('ด.ช.สมชาย'),
    frame({ type: 'delta', text: 'ยังตอบอยู่' }),
  ])
    expect(() => readBrief(stream)).toThrow();
});

it('initializes the alarm, runs manually, deduplicates scheduled delivery, keeps last valid result', async () => {
  vi.useFakeTimers();
  const now = new Date('2026-11-20T23:50:00Z');
  vi.setSystemTime(now);
  const values = new Map();
  let alarm: number | null = null;
  const txn = {
    get: (k: string) => values.get(k),
    put: (k: string, v: unknown) => values.set(k, v),
    getAlarm: () => alarm,
    setAlarm: (v: number) => {
      alarm = v;
    },
  };
  const storage = { ...txn, transaction: (fn: (t: typeof txn) => Promise<unknown>) => fn(txn) };
  let text = 'ภาพรวมห้องตัวอย่าง';
  const fetch = vi.fn(async (r: Request) => {
    expect(new URL(r.url).searchParams.get('role')).toBe('principal');
    expect(((await r.json()) as { agentId: string }).agentId).toBe('rungchao');
    return new Response(response(text), { headers: { 'content-type': 'text/event-stream' } });
  });
  const brief = new MorningBrief(
    { storage } as unknown as DurableObjectState,
    { SANDBOX: { getByName: () => ({ fetch }) } } as unknown as Env,
  );
  const get = () => brief.fetch(new Request('https://crudex.example/api/brief'));
  const run = () =>
    brief.fetch(new Request('https://crudex.example/api/brief/run', { method: 'POST' }));
  expect(await (await get()).json()).toEqual({
    latest: null,
    nextRunAt: Date.parse('2026-11-21T00:00:00Z'),
  });
  expect(fetch).not.toHaveBeenCalled();
  expect((await run()).status).toBe(200);
  vi.setSystemTime(nextMorning(now.getTime()));
  await brief.alarm();
  await brief.alarm();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(alarm).toBe(Date.parse('2026-11-22T00:00:00Z'));
  text = 'นักเรียนตัวอย่าง 01';
  expect((await run()).status).toBe(502);
  expect(values.get('latest')).toMatchObject({ trigger: 'scheduled', text: 'ภาพรวมห้องตัวอย่าง' });
});
