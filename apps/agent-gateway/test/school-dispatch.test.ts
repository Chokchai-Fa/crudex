import type * as Sandbox from '../src/sandbox';
import { it, expect, vi, afterEach } from 'vitest';
import { SandboxManager } from '../src/sandbox-manager';
import { SchoolDispatch } from '../src/school-dispatch';
import {
  bootSandbox,
  createSandbox,
  rotateAfter,
  stopSandbox,
  upstreamHeader,
} from '../src/sandbox';
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup(limit: number) {
  const data = new Map<string, unknown>();
  const storage = {
    get: async (k: string | string[]) =>
      typeof k === 'string' ? data.get(k) : new Map(k.map((key) => [key, data.get(key)])),
    put: async (k: string | Record<string, unknown>, v: unknown) => {
      for (const [key, value] of typeof k === 'string' ? [[k, v] as const] : Object.entries(k)) {
        if (value instanceof ArrayBuffer && value.byteLength >= 128 * 1024)
          throw new Error('Storage value too large');
        data.set(key, value);
      }
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
  return { manager, gateway, pending, data };
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
  const upstream = vi.fn(async (url: URL, options: RequestInit) => {
    if (url.pathname !== '/chat') return new Response(null, { status: 404 });
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
  vi.stubGlobal('fetch', (url: URL) =>
    Promise.resolve(
      url.pathname === '/chat' ? new Response('complete') : new Response(null, { status: 404 }),
    ),
  );
  const first = turn();
  const second = turn(first.scope.schoolId, first.scope.ownerId);
  await Promise.all(
    [first, second].map(async (t) =>
      expect(await (await post(gateway, t)).text()).toBe('complete'),
    ),
  );
  expect(createSandbox).toHaveBeenCalledTimes(1);
});

const snapshot = { version: 1, memory: {}, approvals: [], notifications: [], briefs: [] };

it('checkpoints a fully streamed demo chat and restores the chunked snapshot before the next chat', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const { manager, pending, data } = setup(10);
  await Promise.all(pending);
  const large = {
    ...snapshot,
    briefs: Array.from({ length: 48 }, (_, i) => ({
      id: 'brief-' + i,
      ownerId: 'fixture',
      text: 'ภาพรวม'.repeat(160),
      createdAt: i,
    })),
  };
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const calls: string[] = [];
  const restoreStarted = Promise.withResolvers<void>();
  const finishRestore = Promise.withResolvers<void>();
  let payload: unknown;
  vi.stubGlobal('fetch', async (url: URL, options: RequestInit) => {
    const method = options.method ?? 'GET';
    calls.push(method + ' ' + url.pathname);
    expect(new Headers(options.headers).get(upstreamHeader)).toBe(
      vi.mocked(bootSandbox).mock.lastCall?.[4],
    );
    if (method === 'PUT') {
      payload = await new Response(options.body).json();
      restoreStarted.resolve();
      await finishRestore.promise;
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/__state') {
      return calls.length === 2 ? Response.json(large) : new Response(null, { status: 503 });
    }
    return calls.length === 1 ? new Response(readable) : new Response('next turn');
  });
  const chat = () =>
    manager.fetch(
      new Request('https://agent.test/api/chat?role=principal', {
        method: 'POST',
        headers: { 'x-crudex-login-id': 'scheduled' },
        body: '{}',
      }),
    );

  const response = await chat();
  const body = response.text();
  await writer.write(new TextEncoder().encode('data: {"type":"done"}\n\n'));
  expect(calls).toEqual(['POST /chat']);
  await writer.close();
  expect(await body).toContain('done');
  await Promise.all(pending);
  expect(calls).toEqual(['POST /chat', 'GET /__state']);
  expect(data.has('runtimeState')).toBe(true);

  vi.setSystemTime(1_000_000 + rotateAfter);
  const next = chat();
  await restoreStarted.promise;
  expect(calls).toEqual(['POST /chat', 'GET /__state', 'GET /__state', 'PUT /__state']);
  const status = await manager.fetch(new Request('https://agent.test/api/status'));
  expect(await status.json()).toMatchObject({ sandbox: 'starting' });
  finishRestore.resolve();
  expect(await (await next).text()).toBe('next turn');
  await Promise.all(pending);
  expect(calls).toEqual([
    'POST /chat',
    'GET /__state',
    'GET /__state',
    'PUT /__state',
    'POST /chat',
    'GET /__state',
  ]);
  expect(payload).toEqual(large);
});

it('saves before idle shutdown and restores only the matching school owner', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const { manager, gateway, pending } = setup(10);
  await Promise.all(pending);
  const first = turn();
  const restores: unknown[] = [];
  const firstState = {
    ...snapshot,
    memory: {
      [first.scope.ownerId]: [{ id: 'memory-1', text: 'Graph paper', updatedAt: 1 }],
    },
  };
  let state = firstState;
  let checkpointed = false;
  vi.mocked(stopSandbox).mockImplementationOnce(async () => {
    expect(checkpointed).toBe(true);
  });
  vi.stubGlobal('fetch', async (url: URL, options: RequestInit) => {
    if (url.pathname === '/chat') return new Response('done');
    if (options.method === 'PUT') {
      restores.push(await new Response(options.body).json());
      return new Response(null, { status: 204 });
    }
    checkpointed = state !== firstState;
    return Response.json(state);
  });
  const chat = async (payload: ReturnType<typeof turn>) => {
    expect(await (await post(gateway, payload)).text()).toBe('done');
    await Promise.all(pending);
  };

  await chat(first);
  state = { ...firstState, memory: { ...firstState.memory, fixture: [] } };
  const idleState = state;
  vi.setSystemTime(1_000_000 + 11 * 60_000);
  await manager.alarm();
  expect(stopSandbox).toHaveBeenCalledOnce();
  state = { ...firstState, memory: {} };
  await chat(turn(first.scope.schoolId));
  expect(restores).toEqual([]);
  await chat(turn(first.scope.schoolId, first.scope.ownerId));
  expect(restores).toEqual([idleState]);
});

it('still serves the chat when restoring the saved snapshot fails', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  const { manager, pending, data } = setup(10);
  await Promise.all(pending);
  data.set('runtimeState', 1);
  data.set('runtimeState:0', new TextEncoder().encode(JSON.stringify(snapshot)).buffer);
  const calls: string[] = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', async (url: URL, options: RequestInit) => {
    const method = options.method ?? 'GET';
    calls.push(method + ' ' + url.pathname);
    if (method === 'PUT') return Response.json({ error: 'invalid_state' }, { status: 400 });
    if (url.pathname === '/__state') return Response.json(snapshot);
    return new Response('answer');
  });
  const response = await manager.fetch(
    new Request('https://agent.test/api/chat?role=principal', {
      method: 'POST',
      headers: { 'x-crudex-login-id': 'scheduled' },
      body: '{}',
    }),
  );
  expect(await response.text()).toBe('answer');
  await Promise.all(pending);
  expect(calls.slice(0, 2)).toEqual(['PUT /__state', 'POST /chat']);
});
