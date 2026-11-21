import type * as Sandbox from '../src/sandbox';
import { it, expect, vi, afterEach } from 'vitest';
import { SandboxManager } from '../src/sandbox-manager';
import { SchoolDispatch } from '../src/school-dispatch';
import { bootSandbox, createSandbox, stopSandbox } from '../src/sandbox';
vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
  WorkerEntrypoint: class {
    constructor(
      readonly ctx: unknown,
      readonly env: unknown,
    ) {}
  },
}));
vi.mock('../src/sandbox', async (original) => ({
  ...(await original<typeof Sandbox>()),
  bootSandbox: vi.fn(),
  createSandbox: vi.fn(),
  stopSandbox: vi.fn(),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(limit: number) {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (k: string) => data.get(k),
    put: async (k: string | Record<string, unknown>, v: unknown) => {
      for (const [key, value] of typeof k === 'string' ? [[k, v] as const] : Object.entries(k))
        data.set(key, value);
    },
    delete: async (k: string | string[]) => {
      for (const key of [k].flat()) data.delete(key);
    },
    setAlarm: vi.fn(),
    transaction: async (fn: (s: unknown) => unknown) => fn(storage),
  };
  const pending: Promise<unknown>[] = [];
  const ctx = {
    storage,
    waitUntil: (p: Promise<unknown>) => pending.push(p),
    blockConcurrencyWhile: (fn: () => Promise<unknown>) => pending.push(fn()),
  } as unknown as DurableObjectState;
  const env = {
    PASSCODE: 'demo',
    OPENAI_API_KEY: 'synthetic',
    VERCEL_TOKEN: 'synthetic',
    VERCEL_TEAM_ID: 'test',
    VERCEL_PROJECT_ID: 'test',
    DAILY_RUN_LIMIT: String(limit),
  } as Env;
  const manager = new SandboxManager(ctx, env);
  const gateway = new SchoolDispatch(
    {} as ExecutionContext,
    {
      SANDBOX: {
        getByName: () => ({
          fetch: (url: URL, opts: RequestInit) => manager.fetch(new Request(url, opts)),
        }),
      },
    } as unknown as Env,
  );
  vi.mocked(bootSandbox).mockResolvedValue('https://runtime.test');
  vi.mocked(createSandbox).mockImplementation(
    async () =>
      ({ name: crypto.randomUUID(), createdAt: new Date() }) as Awaited<
        ReturnType<typeof createSandbox>
      >,
  );
  return { gateway, pending };
}
function turn(schoolId = crypto.randomUUID(), ownerId = crypto.randomUUID()) {
  return {
    text: 'worksheet',
    agentId: 'jum',
    scope: {
      agentId: 'jum',
      role: 'teacher',
      schoolId,
      ownerId,
      classId: null,
      attemptId: crypto.randomUUID(),
      runId: crypto.randomUUID(),
      expiresAt: Date.now() + 600000,
      credential: crypto.randomUUID() + crypto.randomUUID(),
      freshSession: false,
      callbackOrigin: 'https://school.test',
    },
  };
}
function post(gateway: SchoolDispatch, payload: ReturnType<typeof turn>) {
  return gateway.fetch(
    new Request('https://agent.test/dispatch', { method: 'POST', body: JSON.stringify(payload) }),
  );
}
it('rejects expired claims before boot, signs school turns, rotates across owners and shares one cap', async () => {
  const { gateway, pending } = setup(2);
  await Promise.all(pending);
  const first = turn();
  const bad = structuredClone(first);
  bad.scope.expiresAt = Date.now() - 1;
  expect((await post(gateway, bad)).status).toBe(403);
  expect(createSandbox).not.toHaveBeenCalled();
  const upstream = vi.fn(async (_url: URL, options: RequestInit) => {
    expect(new Headers(options.headers).get('x-school-signature')).toMatch(/^[a-f0-9]{64}$/);
    return new Response('data: {"type":"done","elapsedMs":1}\n\n');
  });
  vi.stubGlobal('fetch', upstream);
  expect(await (await post(gateway, first)).text()).toContain('done');
  const second = turn(first.scope.schoolId);
  expect(await (await post(gateway, second)).text()).toContain('done');
  expect(vi.mocked(bootSandbox).mock.calls.map((c) => c[5])).toEqual(
    [first, second].map((t) => t.scope.schoolId + '/' + t.scope.ownerId),
  );
  expect(stopSandbox).toHaveBeenCalledTimes(1);
  expect((await post(gateway, second)).status).toBe(429);
  await Promise.all(pending);
});
it('shares a cold boot between concurrent turns for the same owner', async () => {
  const { gateway, pending } = setup(10);
  await Promise.all(pending);
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('complete')));
  const first = turn();
  const second = turn(first.scope.schoolId, first.scope.ownerId);
  await Promise.all(
    [first, second].map(async (t) =>
      expect(await (await post(gateway, t)).text()).toBe('complete'),
    ),
  );
  expect(createSandbox).toHaveBeenCalledTimes(1);
});
