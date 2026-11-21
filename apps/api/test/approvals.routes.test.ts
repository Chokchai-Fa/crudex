import { exports as workers } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../src/repositories/approvals.repository';
import * as identity from '../src/repositories/identity.repository';
import type { SchoolRole } from '@repo/shared';

vi.mock('../src/repositories/approvals.repository');
vi.mock('../src/repositories/identity.repository');

const base = 'https://example.com/api';
const scope = {
  schoolId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  membershipId: crypto.randomUUID(),
};
const claim = {
  clientRequestId: crypto.randomUUID(),
  date: '2026-11-21',
  budgetCode: 'A1',
  purpose: 'Class supplies',
  items: [{ name: 'Notebook', quantity: 3, unitPriceSatang: 1250 }],
};
const row = {
  ...claim,
  id: crypto.randomUUID(),
  teacherId: scope.membershipId,
  schoolId: scope.schoolId,
  status: 'pending' as const,
  decidedBy: null,
  decidedAt: null,
  reason: null,
  submittedAt: new Date(),
};
const cookie = '__Host-school_session=' + 'a'.repeat(64);
function role(role: SchoolRole) {
  vi.mocked(identity.findMembership).mockResolvedValue({
    ...scope,
    displayName: 'Synthetic account',
    role,
  });
}
function post(path: string, body: unknown, headers: Record<string, string> = { cookie }) {
  return workers.default.fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  role('teacher');
  vi.mocked(identity.findSession).mockResolvedValue(scope);
  vi.mocked(identity.listAssignedClasses).mockResolvedValue([]);
  vi.mocked(identity.listSchoolClasses).mockResolvedValue([]);
});
describe('school budget approvals', () => {
  it('validates teacher submissions and compares the immutable content when a key is replayed', async () => {
    vi.mocked(repo.submit).mockResolvedValue(row);
    const first = await post('/approvals', claim);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ id: row.id, totalSatang: 3750 });
    expect((await post('/approvals', claim)).status).toBe(201);
    expect((await post('/approvals', { ...claim, purpose: 'Different use' })).status).toBe(409);
    expect((await post('/approvals', { ...claim, schoolId: scope.schoolId })).status).toBe(400);
    expect(
      (
        await post('/approvals', {
          ...claim,
          items: [{ ...claim.items[0], unitPriceSatang: 0.42 }],
        })
      ).status,
    ).toBe(400);
  });
  it('only accepts an authenticated principal decision with a return reason', async () => {
    const path = '/approvals/' + row.id + '/decision';
    expect(
      (await post(path, { decision: 'approve' }, { authorization: 'Bearer model-token' })).status,
    ).toBe(401);
    expect((await post(path, { decision: 'approve' })).status).toBe(403);
    role('principal');
    expect((await post(path, { decision: 'return', reason: '  ' })).status).toBe(400);
    expect(
      (await post(path, { decision: 'approve' }, { cookie, origin: 'https://other.example' }))
        .status,
    ).toBe(403);
    expect(repo.decide).not.toHaveBeenCalled();
    vi.mocked(repo.decide).mockResolvedValue({
      ...row,
      status: 'returned',
      reason: 'Missing receipt',
      decidedAt: new Date(),
      decidedBy: scope.membershipId,
    });
    expect((await post(path, { decision: 'return', reason: 'Missing receipt' })).status).toBe(200);
    expect((await post(path, { decision: 'approve' })).status).toBe(409);
    vi.mocked(repo.decide).mockResolvedValue(undefined);
    expect((await post(path, { decision: 'approve' })).status).toBe(404);
  });
  it('denies students access, resolves claim read scope from the session and rejects an arbitrary tool token', async () => {
    role('student');
    expect((await workers.default.fetch(base + '/approvals', { headers: { cookie } })).status).toBe(
      403,
    );
    expect(
      (await workers.default.fetch(base + '/approval-notifications', { headers: { cookie } }))
        .status,
    ).toBe(403);
    role('teacher');
    vi.mocked(repo.get).mockResolvedValue(undefined);
    expect(
      (await workers.default.fetch(base + '/approvals/' + row.id, { headers: { cookie } })).status,
    ).toBe(404);
    expect(repo.get).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ...scope, role: 'teacher' }),
      row.id,
    );
    expect(
      (
        await post(
          '/internal/runs/' + row.id + '/tools/get_approval',
          { approvalId: row.id },
          { authorization: 'Bearer invalid' },
        )
      ).status,
    ).toBe(403);
  });
});
