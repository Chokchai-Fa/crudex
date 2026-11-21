import { once } from 'node:events';
import { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

const runTurn = vi.hoisted(() => vi.fn());
vi.mock('../src/harness', () => ({
  createHarness: () => ({ host: {}, directory: '.', toolCalls: new Map() }),
}));
vi.mock('../src/run', () => ({ createTurnRunner: () => runTurn }));

let server: Server;
let origin: string;
const headers = { 'x-crudex-upstream-token': 'fixture', 'content-type': 'application/json' };

beforeAll(async () => {
  vi.stubEnv('UPSTREAM_TOKEN', 'fixture');
  vi.stubEnv('OPENAI_API_KEY', 'fixture');
  vi.stubEnv('DATA_DIR', '.');
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
