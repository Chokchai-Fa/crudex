import { beforeEach, expect, it, vi } from 'vitest';
import type { SchoolActor } from '@repo/shared';
import type { Cache } from '../src/lib/cache';
import * as repo from '../src/repositories/classroom.repository';
import { brief, principalTool, publishBrief } from '../src/services/classroom.service';
import { authorizeRunTool } from '../src/services/runs.service';
import { makeFakeDeps } from './support/fake-deps';
vi.mock('../src/repositories/classroom.repository');
vi.mock('../src/services/runs.service');

const schoolId = crypto.randomUUID();
const principal = {
  schoolId,
  ownerId: crypto.randomUUID(),
  membershipId: crypto.randomUUID(),
  role: 'principal',
  displayName: 'Synthetic principal',
  classes: [],
  children: [],
} as SchoolActor;
const counts = { classes: 3, students: 60, submissions: 0, averagePercent: null, reports: 0 };
function deps() {
  const store = new Map<string, unknown>();
  const d = makeFakeDeps().deps;
  d.cache = {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: unknown) => void store.set(k, v),
  } as unknown as Cache;
  return d;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.morningBrief).mockResolvedValue(counts);
  vi.mocked(authorizeRunTool).mockResolvedValue({ role: 'principal', schoolId } as never);
});

it('returns sample flagged rooms and no published brief before rungchao publishes', async () => {
  const r = await brief(deps(), principal);
  expect(r).toMatchObject({ ...counts, briefTitle: null, briefLines: [], flaggedSource: 'sample' });
  expect(r.flaggedClasses[0]).toMatchObject({
    label: 'ม.2/1',
    mean: 3.5,
    maxScore: 6,
    meanLabel: '3.5/6 คะแนน',
    meanPercent: 58,
    weakTopics: [{ topic: 'การนำพีทาโกรัสไปใช้ในชีวิตจริง', correctPercent: 37.5 }],
  });
});

it('returns the published title and numbered lines verbatim', async () => {
  const d = deps();
  const text =
    'สรุปเช้าวันเสาร์\n1. ครูใช้ crudex เมื่อวาน 1 คน ทำสื่อ 3 ชุด\n2. เอกสารรออนุมัติ 1 รายการ';
  await publishBrief(d, 'run', 'token', text);
  const r = await brief(d, principal);
  expect(r.briefTitle).toBe('สรุปเช้าวันเสาร์');
  expect(r.briefLines).toEqual([
    '1. ครูใช้ crudex เมื่อวาน 1 คน ทำสื่อ 3 ชุด',
    '2. เอกสารรออนุมัติ 1 รายการ',
  ]);
});

it('refuses publish from a teacher run and from a brief without items', async () => {
  vi.mocked(authorizeRunTool).mockResolvedValueOnce({ role: 'teacher', schoolId } as never);
  await expect(publishBrief(deps(), 'run', 'token', 'สรุปเช้าวันเสาร์\n1. x')).rejects.toThrow();
  await expect(publishBrief(deps(), 'run', 'token', 'สรุปเช้าวันเสาร์')).rejects.toThrow();
});

it('the school get_school_summary gives rungchao the design title and room line', async () => {
  vi.mocked(repo.morningBrief).mockResolvedValue(counts);
  const r = (await principalTool(deps(), 'run', 'token', false)) as Record<string, unknown>;
  expect(r.briefTitle).toMatch(/^สรุปเช้าวัน/);
  expect(r.briefClassLine).toContain('ม.2/1 เฉลี่ย 3.5/6 (58%)');
});
