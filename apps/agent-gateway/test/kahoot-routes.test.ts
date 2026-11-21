import { afterEach, expect, it, vi } from 'vitest';
import { sessionCookie } from '../src/gate';
import gateway from '../src/index';
import { SandboxManager } from '../src/sandbox-manager';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
  WorkerEntrypoint: class {},
}));

const origin = 'https://crudex.example';
const path = '/__kahoot/mcp';
const credential = 'ab'.repeat(32);
const fixturePasscode = 'example-sign-in';

afterEach(() => vi.unstubAllGlobals());

it('requires a gate session for connect, status and disconnect and accepts a cookie-free callback', async () => {
  const authorize = 'https://mcp.kahoot.it/authorize';
  const beginAuthorization = vi.fn(async () => authorize);
  const status = vi.fn(async () => ({ connected: true, connectedAt: 10, expiresAt: 20 }));
  const disconnect = vi.fn(async () => {});
  const callback = vi.fn(
    async (code: string | null, state: string) => !!code && state === 'example',
  );
  const getByName = vi.fn(() => ({ beginAuthorization, status, disconnect, callback }));
  const env = { PASSCODE: fixturePasscode, KAHOOT: { getByName } } as unknown as Env;
  const call = (path: string, options?: RequestInit) =>
    gateway.fetch(new Request(origin + path, options), env);
  const cookie = (await sessionCookie(fixturePasscode)).split(';')[0]!;
  const headers = { cookie };

  const anonymous = await call('/kahoot/connect');
  expect(anonymous.status).toBe(303);
  expect(anonymous.headers.get('location')).toBe('/login');
  expect((await call('/api/kahoot/status')).status).toBe(401);
  expect((await call('/api/kahoot/disconnect', { method: 'POST' })).status).toBe(401);
  expect(getByName).not.toHaveBeenCalled();

  const redirect = await call('/kahoot/connect', { headers });
  expect(redirect.status).toBe(303);
  expect(redirect.headers.get('location')).toBe(authorize);
  expect(beginAuthorization).toHaveBeenCalledWith(origin);

  const success = await call('/kahoot/callback?code=fixture-code&state=example');
  expect(success.status).toBe(200);
  expect(success.headers.get('cache-control')).toBe('no-store');
  expect(success.headers.get('referrer-policy')).toBe('no-referrer');
  const page = await success.text();
  expect(page).toContain('เชื่อมบัญชี Kahoot แล้ว');
  expect(page).toContain('href="/"');
  expect(page).not.toContain('fixture-code');

  const failed = await call('/kahoot/callback?error=%3Cscript%3E&state=example');
  expect(failed.status).toBe(400);
  expect(await failed.text()).not.toContain('<script>');
  expect(callback.mock.calls).toEqual([
    ['fixture-code', 'example'],
    [null, 'example'],
  ]);

  const result = await call('/api/kahoot/status', { headers });
  expect(await result.json()).toEqual({ connected: true, connectedAt: 10, expiresAt: 20 });
  const crossOrigin = await call('/api/kahoot/disconnect', {
    method: 'POST',
    headers: { ...headers, origin: 'https://another.example' },
  });
  expect(crossOrigin.status).toBe(403);
  expect(disconnect).not.toHaveBeenCalled();
  expect((await call('/api/kahoot/disconnect', { method: 'POST', headers })).ok).toBe(true);
  expect(disconnect).toHaveBeenCalledOnce();
  expect(getByName).toHaveBeenCalledWith('kahoot');
});

it('routes only the supported MCP methods through the sandbox and admits only its current credential', async () => {
  vi.stubGlobal('crypto', {
    subtle: {
      timingSafeEqual: (a: Uint8Array, b: Uint8Array) =>
        a.length === b.length && a.every((byte, i) => byte === b[i]),
    },
  });
  const record = { name: 'example', startedAt: Date.now(), lastUsedAt: Date.now() };
  const running = { ...record, url: 'https://sandbox.example', kahootToken: credential };
  const mcp = vi.fn(async (_request: Request) => new Response(null, { status: 202 }));
  const env = {
    PASSCODE: fixturePasscode,
    KAHOOT: { getByName: () => ({ mcp }) },
    SANDBOX: { getByName: () => manager },
  } as unknown as Env;
  const sandboxManager = async (sandbox: typeof record | typeof running | undefined) => {
    const initialized: Promise<unknown>[] = [];
    const manager = new SandboxManager(
      {
        storage: { get: async () => sandbox },
        blockConcurrencyWhile: (fn: () => Promise<unknown>) => initialized.push(fn()),
      } as unknown as DurableObjectState,
      env,
    );
    await Promise.all(initialized);
    return manager;
  };
  let manager = await sandboxManager(running);
  const call = (method: string, token?: string) =>
    gateway.fetch(
      new Request(origin + path, {
        method,
        headers: token ? { 'x-crudex-kahoot-token': token } : undefined,
      }),
      env,
    );
  expect((await call('POST')).status).toBe(401);
  expect((await call('POST', 'wrong-format')).status).toBe(401);
  expect((await call('POST', 'ac'.repeat(32))).status).toBe(401);
  expect((await call('PUT', credential)).status).toBe(401);
  expect(mcp).not.toHaveBeenCalled();
  for (const method of ['GET', 'POST', 'DELETE']) {
    expect((await call(method, credential)).status).toBe(202);
  }

  manager = await sandboxManager({ ...running, kahootToken: 'ff'.repeat(32) });
  expect((await call('POST', credential)).status).toBe(401);
  manager = await sandboxManager(record);
  expect((await call('POST', credential)).status).toBe(401);
  manager = await sandboxManager(undefined);
  expect((await call('POST', credential)).status).toBe(401);
  expect(mcp.mock.calls.map(([request]) => request.method)).toEqual(['GET', 'POST', 'DELETE']);
});
