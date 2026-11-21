import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as repo from '../src/repositories/identity.repository';

vi.mock('../src/repositories/identity.repository');
const base = 'https://example.com/api';
const credential = 'a'.repeat(64);
const scope = {
  schoolId: 'cdbdeb88-fc69-47ac-a862-408269305851',
  membershipId: '1433a377-7c57-43b7-9516-2afb10c0cf58',
  ownerId: '40e04813-05af-482b-8afa-aceb31242fef',
};
function post(path: string, data: unknown, headers: Record<string, string> = {}) {
  return exports.default.fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(data),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(repo.findSession).mockResolvedValue(scope);
  vi.mocked(repo.findMembership).mockResolvedValue({
    ...scope,
    role: 'teacher',
    displayName: 'Teacher One',
  });
  vi.mocked(repo.listMemberships).mockResolvedValue([]);
  vi.mocked(repo.listAssignedClasses).mockResolvedValue([]);
});

describe('school session boundary', () => {
  it('requires a session and ignores actor headers', async () => {
    const res = await exports.default.fetch(base + '/me', {
      headers: { 'X-Role': 'principal', 'X-Owner-Id': scope.ownerId },
    });
    expect(res.status).toBe(401);
    expect(repo.findSession).not.toHaveBeenCalled();
  });
  it('accepts a valid single-use invitation and loads the role and classes from storage', async () => {
    vi.mocked(repo.exchangeInvitation).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const signed = await post('/auth/session', { credential }, { 'x-role': 'principal' });
    expect(signed.status).toBe(200);
    const cookie = signed.headers.get('Set-Cookie')!;
    expect(cookie).toMatch(/__Host-school_session=[a-f0-9]{64}/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(await signed.json()).toMatchObject({ actor: { ...scope, role: 'teacher' } });
    expect(repo.listAssignedClasses).toHaveBeenCalledWith(expect.anything(), scope.membershipId);
    expect(repo.listSchoolClasses).not.toHaveBeenCalled();
    expect((await post('/auth/session', { credential })).status).toBe(401);
  });
  it('rejects an expired session and unauthorized school switch', async () => {
    const headers = { cookie: '__Host-school_session=' + 'b'.repeat(64) };
    vi.mocked(repo.findSession).mockResolvedValueOnce(undefined);
    expect((await exports.default.fetch(base + '/me', { headers })).status).toBe(401);
    vi.mocked(repo.selectMembership).mockResolvedValue(false);
    expect(
      (await post('/auth/membership', { membershipId: crypto.randomUUID() }, headers)).status,
    ).toBe(403);
  });
  it('rejects cross-origin writes, client-supplied roles and shared-environment demo login', async () => {
    expect(
      (await post('/auth/session', { credential }, { origin: 'https://foreign.example' })).status,
    ).toBe(403);
    expect((await post('/auth/session', { credential, role: 'principal' })).status).toBe(400);
    expect((await post('/auth/local', { school: 'lotus', role: 'principal' })).status).toBe(404);
    expect(repo.exchangeInvitation).not.toHaveBeenCalled();
  });
});
