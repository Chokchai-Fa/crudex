import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const runTurn = vi.hoisted(() => vi.fn());
vi.mock('../src/harness', () => ({
  createHarness: () => ({ host: {}, directory: '.', toolCalls: new Map() }),
}));
vi.mock('../src/run', () => ({ createTurnRunner: () => runTurn }));

let server: Server;
let origin: string;
let dataDir: string;
const headers = { 'x-crudex-upstream-token': 'fixture', 'content-type': 'application/json' };

beforeAll(async () => {
  vi.stubEnv('UPSTREAM_TOKEN', 'fixture');
  vi.stubEnv('OPENAI_API_KEY', 'fixture');
  dataDir = await mkdtemp(join(tmpdir(), 'crudex-agent-routes-'));
  vi.stubEnv('DATA_DIR', dataDir);
  // Let the OS allocate the test server's port.
  const listen = Server.prototype.listen;
  vi.spyOn(Server.prototype, 'listen').mockImplementationOnce(function (this: Server) {
    server = listen.call(this, { port: 0, host: '127.0.0.1' });
    return server;
  });
  await import('../src/server');
  if (!server.listening) await once(server, 'listening');
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});

afterAll(async () => {
  if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

it.each([
  ['', ['jaew', 'jum', 'jeng', 'porn', 'nun']],
  ['?role=principal', ['rungchao', 'lekha_por']],
] as const)(
  'exposes only the role catalog and rejects a direct test-agent chat %s',
  async (query, ids) => {
    const catalog = await fetch(origin + '/agents' + query, { headers });
    expect(catalog.status).toBe(200);
    expect(await catalog.json()).toEqual(ids.map((id) => expect.objectContaining({ id })));

    const chat = await fetch(origin + '/chat' + query, {
      method: 'POST',
      headers,
      body: JSON.stringify({ agentId: 'test-agent', text: 'Test' }),
    });
    expect(chat.status).toBe(400);
    expect(await chat.json()).toEqual({ error: 'unknown_agent' });
    expect(runTurn).not.toHaveBeenCalled();
  },
);

it('authenticates state transfer and validates before replacing the persisted snapshot', async () => {
  const url = origin + '/__state';
  const put = (body: string, auth: Record<string, string> = headers) =>
    fetch(url, { method: 'PUT', headers: auth, body });
  const snapshot = {
    version: 1,
    memory: { 'owner:fixture': [{ id: 'memory-fixture', text: 'Use graph paper', updatedAt: 10 }] },
    approvals: [],
    notifications: [],
    briefs: [],
    inbox: [],
    activity: [],
  };
  expect((await fetch(url)).status).toBe(401);
  expect((await put(JSON.stringify(snapshot), {})).status).toBe(401);
  expect((await put(JSON.stringify(snapshot))).status).toBe(204);
  expect((await put(JSON.stringify({ ...snapshot, version: 2 }))).status).toBe(400);
  expect((await put('{invalid')).status).toBe(400);
  expect((await put(' '.repeat(1024 * 1024) + JSON.stringify(snapshot))).status).toBe(400);
  const response = await fetch(url, { headers });
  expect(response.status).toBe(200);
  // An empty approval box gets the one sample claim after every restore.
  const restored = {
    ...snapshot,
    approvals: [expect.objectContaining({ id: 'approval-sample-1' })],
  };
  const served = await response.json();
  expect(served).toEqual(restored);
  expect(JSON.parse(await readFile(join(dataDir, 'state.json'), 'utf8'))).toEqual(served);
});
