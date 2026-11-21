import type { KahootStatus, SchoolKahootAccount, SchoolRole } from '@repo/shared';
import { env } from 'cloudflare:workers';
import { beforeEach, expect, it, vi } from 'vitest';
import app from '../src/app';
import * as identity from '../src/repositories/identity.repository';

vi.mock('../src/repositories/identity.repository');

const origin = 'https://school.example';
const prefix = '/api/integrations/kahoot';
const account = {
  schoolId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  role: 'teacher',
} satisfies SchoolKahootAccount;
const membership = {
  ...account,
  membershipId: crypto.randomUUID(),
  displayName: 'Synthetic teacher',
};
const cookie = '__Host-school_session=' + 'a'.repeat(64);
const authorizeUrl = 'https://mcp.kahoot.it/authorize?state=fixture';
const gateway = {
  fetch: vi.fn(),
  kahootConnect: vi.fn(async () => ({ url: authorizeUrl })),
  kahootStatus: vi.fn(async (): Promise<KahootStatus> => ({
    connected: true,
    connectedAt: 10,
    expiresAt: 20,
  })),
  kahootCallback: vi.fn(async (_state: string, code: string | null) => ({
    ok: code === 'fixture-code',
  })),
  kahootDisconnect: vi.fn(async (): Promise<KahootStatus> => ({ connected: false })),
};

function request(path: string, options?: RequestInit) {
  return app.request(origin + prefix + path, options, { ...env, SCHOOL_GATEWAY: gateway });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(identity.findSession).mockResolvedValue(membership);
  vi.mocked(identity.findMembership).mockResolvedValue(membership);
  vi.mocked(identity.listAssignedClasses).mockResolvedValue([]);
  vi.mocked(identity.listSchoolClasses).mockResolvedValue([]);
  vi.mocked(identity.listChildren).mockResolvedValue([]);
});

it('uses the teacher session and configured app URL to redirect to Kahoot', async () => {
  const response = await request('/connect', { headers: { cookie } });
  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe(authorizeUrl);
  expect(gateway.kahootConnect).toHaveBeenCalledExactlyOnceWith(
    account,
    'http://localhost:5173/api/integrations/kahoot/callback',
  );
  const status = await request('/status', { headers: { cookie } });
  expect(status.status).toBe(200);
  expect(await status.json()).toEqual({ connected: true, connectedAt: 10, expiresAt: 20 });
  expect(gateway.kahootStatus).toHaveBeenCalledExactlyOnceWith(account);
});

it.each(['principal', 'guardian', 'student'] satisfies SchoolRole[])(
  'denies a %s session on every account route',
  async (role) => {
    vi.mocked(identity.findMembership).mockResolvedValue({ ...membership, role });
    expect((await request('/connect', { headers: { cookie } })).status).toBe(403);
    expect((await request('/status', { headers: { cookie } })).status).toBe(403);
    expect((await request('/disconnect', { method: 'POST', headers: { cookie } })).status).toBe(
      403,
    );
    expect(gateway.kahootConnect).not.toHaveBeenCalled();
    expect(gateway.kahootStatus).not.toHaveBeenCalled();
    expect(gateway.kahootDisconnect).not.toHaveBeenCalled();
  },
);

it('requires authentication on the account routes', async () => {
  expect((await request('/connect')).status).toBe(401);
  expect((await request('/status')).status).toBe(401);
  expect((await request('/disconnect', { method: 'POST' })).status).toBe(401);
});

it('uses the OAuth state without a session and returns only a result', async () => {
  for (const [query, expected] of [
    ['state=fixture-state&code=fixture-code', 'connected'],
    ['state=fixture-state&error=fixture-error&code=fixture-code', 'failed'],
    ['state=fixture-state&code=wrong', 'failed'],
    ['code=fixture-code', 'failed'],
  ]) {
    const response = await request('/callback?' + query);
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/?kahoot=' + expected);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await response.text()).toBe('');
  }
  expect(identity.findSession).not.toHaveBeenCalled();
  expect(gateway.kahootCallback.mock.calls).toEqual([
    ['fixture-state', 'fixture-code'],
    ['fixture-state', null],
    ['fixture-state', 'wrong'],
  ]);
});

it('checks the origin before disconnecting the teacher account', async () => {
  const disconnect = (origin: string) =>
    request('/disconnect', { method: 'POST', headers: { cookie, origin } });
  expect((await disconnect('https://foreign.example')).status).toBe(403);
  expect(gateway.kahootDisconnect).not.toHaveBeenCalled();
  const response = await disconnect(origin);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ connected: false });
  expect(gateway.kahootDisconnect).toHaveBeenCalledExactlyOnceWith(account);
});
