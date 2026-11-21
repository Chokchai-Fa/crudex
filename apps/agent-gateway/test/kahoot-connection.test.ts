import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { kahootConnection } from './support/kahoot';
import type { KahootConnection } from '../src/kahoot-connection';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(readonly ctx: unknown) {}
  },
}));

const origin = 'https://crudex.example';
const issuer = 'https://mcp.kahoot.it';
const resource = issuer + '/mcp';
const client = { client_id: 'example-client', client_secret: 'fixture-client-secret' };
const tokens = {
  access_token: 'fixture-access',
  refresh_token: 'fixture-refresh',
  expires_in: 120,
};
const timestamp = 1_800_000_000_000;

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(timestamp);
  fetchMock.mockReset().mockImplementation(async (url, init) => {
    if (String(url) === issuer + '/register') return Response.json(client);
    if (String(url) === issuer + '/token') {
      const grant = new URLSearchParams(String(init?.body)).get('grant_type');
      if (grant === 'authorization_code') return Response.json(tokens);
    }
    throw new Error('Unexpected fetch');
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function authorize(kahoot: KahootConnection, redirectUri = origin + '/kahoot/callback') {
  return new URL(await kahoot.beginAuthorization(redirectUri));
}

async function connected() {
  const kahoot = kahootConnection();
  const url = await authorize(kahoot);
  expect(await kahoot.callback('fixture-code', url.searchParams.get('state')!)).toBe(true);
  return kahoot;
}

function rpc(method: string, params?: unknown) {
  return { jsonrpc: '2.0', id: 1, method, params };
}

function post(body: unknown, headers?: HeadersInit) {
  return new Request(origin + '/__kahoot/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

it('registers once and exchanges a code with S256 PKCE and a single-use state', async () => {
  const kahoot = kahootConnection();
  const [first, second] = await Promise.all([authorize(kahoot), authorize(kahoot)]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [registerUrl, registration] = fetchMock.mock.calls[0]!;
  expect(String(registerUrl)).toBe(issuer + '/register');
  expect(registration?.method).toBe('POST');
  expect(registration?.redirect).toBe('manual');
  expect(JSON.parse(String(registration?.body))).toEqual({
    client_name: 'Crudex School Bot',
    redirect_uris: [origin + '/kahoot/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'client_secret_post',
    scope: 'openid offline_access',
  });
  expect(first.origin + first.pathname).toBe(issuer + '/authorize');
  expect(Object.fromEntries(first.searchParams)).toMatchObject({
    client_id: client.client_id,
    redirect_uri: origin + '/kahoot/callback',
    response_type: 'code',
    resource,
    scope: 'openid offline_access',
    code_challenge_method: 'S256',
  });
  const state = first.searchParams.get('state')!;
  expect(state).toBeTruthy();
  expect(state).not.toBe(second.searchParams.get('state'));
  await expect(
    Promise.all([kahoot.callback('fixture-code', state), kahoot.callback('fixture-code', state)]),
  ).resolves.toEqual([true, false]);

  const [tokenUrl, exchange] = fetchMock.mock.calls[1]!;
  expect(String(tokenUrl)).toBe(issuer + '/token');
  expect(exchange?.redirect).toBe('manual');
  const form = new URLSearchParams(String(exchange?.body));
  expect(Object.fromEntries(form)).toEqual({
    grant_type: 'authorization_code',
    code: 'fixture-code',
    redirect_uri: origin + '/kahoot/callback',
    ...client,
    code_verifier: expect.stringMatching(/^[A-Za-z0-9._~-]{43,128}$/),
    resource,
  });
  const verifier = new TextEncoder().encode(form.get('code_verifier')!);
  const digest = await crypto.subtle.digest('SHA-256', verifier);
  const challenge = first.searchParams.get('code_challenge')!;
  expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(atob(challenge.replaceAll('-', '+').replaceAll('_', '/'))).toBe(
    String.fromCharCode(...new Uint8Array(digest)),
  );
  expect(await kahoot.status()).toEqual({
    connected: true,
    connectedAt: timestamp,
    expiresAt: timestamp + 120_000,
  });
});

it('limits pending attempts to eight and consumes expired and cancelled states', async () => {
  const kahoot = kahootConnection();
  const attempts = await Promise.all(Array.from({ length: 9 }, () => authorize(kahoot)));
  const state = (i: number) => attempts[i]!.searchParams.get('state')!;
  expect(await kahoot.callback('fixture-code', state(0))).toBe(false);
  expect(await kahoot.callback(null, state(1))).toBe(false);
  expect(await kahoot.callback('fixture-code', state(1))).toBe(false);
  expect(await kahoot.callback('fixture-code', state(2))).toBe(true);
  vi.mocked(Date.now).mockReturnValue(timestamp + 600_000);
  expect(await kahoot.callback('fixture-code', state(8))).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('refreshes once for concurrent requests, preserves the refresh token, and clears invalid grants', async () => {
  const kahoot = await connected();
  vi.mocked(Date.now).mockReturnValue(timestamp + 60_000);
  fetchMock.mockClear().mockImplementation(async (url, init) => {
    if (String(url) === issuer + '/token') {
      expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        resource,
        ...client,
      });
      await Promise.resolve();
      return Response.json({ access_token: 'fixture-refreshed', expires_in: 120 });
    }
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer fixture-refreshed');
    return new Response(null, { status: 202 });
  });
  const responses = await Promise.all(
    Array.from({ length: 5 }, () => kahoot.mcp(post(rpc('ping')))),
  );
  expect(responses.map(({ status }) => status)).toEqual(Array(5).fill(202));
  expect(fetchMock.mock.calls.filter(([url]) => String(url) === issuer + '/token')).toHaveLength(1);
  expect(await kahoot.status()).toEqual({
    connected: true,
    connectedAt: timestamp,
    expiresAt: timestamp + 180_000,
  });

  vi.mocked(Date.now).mockReturnValue(timestamp + 120_000);
  fetchMock.mockClear().mockImplementation(async (_url, init) => {
    expect(new URLSearchParams(String(init?.body)).get('refresh_token')).toBe(tokens.refresh_token);
    return Response.json({ error: 'invalid_grant' }, { status: 400 });
  });
  const disconnected = await kahoot.mcp(post(rpc('ping')));
  expect(disconnected.status).toBe(401);
  expect(await disconnected.json()).toEqual({ error: 'kahoot_not_connected' });
  expect(await kahoot.status()).toEqual({ connected: false });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it('revokes refresh then access, retains the registration and disconnects idempotently', async () => {
  const kahoot = await connected();
  const revoked: string[] = [];
  fetchMock.mockClear().mockImplementation(async (url, init) => {
    expect(String(url)).toBe(issuer + '/revoke');
    const form = Object.fromEntries(new URLSearchParams(String(init?.body)));
    expect(form).toMatchObject(client);
    revoked.push(form.token!);
    if (form.token === tokens.refresh_token) throw new Error('Revocation unavailable');
    return new Response(null, { status: 200 });
  });

  await Promise.all([kahoot.disconnect(), kahoot.disconnect()]);
  expect(revoked).toEqual([tokens.refresh_token, tokens.access_token]);
  expect(await kahoot.status()).toEqual({ connected: false });
  await authorize(kahoot);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it('registers again for a new redirect URI and revokes the original grant with its client', async () => {
  const kahoot = await connected();
  const nextOrigin = 'https://another.example';
  fetchMock.mockResolvedValueOnce(Response.json({ client_id: 'next-client' }));
  expect(
    (await authorize(kahoot, nextOrigin + '/kahoot/callback')).searchParams.get('redirect_uri'),
  ).toBe(nextOrigin + '/kahoot/callback');
  expect(String(fetchMock.mock.calls[2]?.[0])).toBe(issuer + '/register');
  fetchMock.mockClear().mockResolvedValue(new Response(null));
  await kahoot.disconnect();
  for (const [, init] of fetchMock.mock.calls) {
    expect(new URLSearchParams(String(init?.body)).get('client_id')).toBe(client.client_id);
  }
});

it('keeps pending attempts bound to their client when the redirect URI changes', async () => {
  const kahoot = kahootConnection();
  const first = await authorize(kahoot);
  fetchMock.mockResolvedValueOnce(Response.json({ client_id: 'next-client' }));
  const second = await authorize(kahoot, 'https://another.example/kahoot/callback');
  const firstState = first.searchParams.get('state')!;
  const secondState = second.searchParams.get('state')!;

  expect(await kahoot.callback('fixture-first-code', firstState)).toBe(true);
  expect(await kahoot.callback('fixture-second-code', secondState)).toBe(true);
  const exchanges = fetchMock.mock.calls
    .slice(2)
    .map(([, init]) => Object.fromEntries(new URLSearchParams(String(init?.body))));
  expect(exchanges).toMatchObject([
    { ...client, redirect_uri: origin + '/kahoot/callback' },
    { client_id: 'next-client', redirect_uri: 'https://another.example/kahoot/callback' },
  ]);
  expect(exchanges[1]).not.toHaveProperty('client_secret');
});

it('forwards only the allowed MCP methods, tools and headers and returns the SSE stream', async () => {
  const kahoot = await connected();
  const messages = [
    rpc('initialize'),
    rpc('ping'),
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    rpc('tools/list'),
    rpc('tools/call', { name: 'get_kahoot', arguments: { uuid: 'example-draft' } }),
    rpc('tools/call', { name: 'get_kahoot_editor_url', arguments: { uuid: 'example-draft' } }),
    rpc('tools/call', { name: 'create_or_update_kahoot', arguments: { title: 'example' } }),
  ];
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  fetchMock.mockClear().mockImplementation(async (url, init) => {
    expect(String(url)).toBe(resource);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(new TextDecoder().decode(init?.body as Uint8Array))).toEqual(
      JSON.parse(JSON.stringify(messages)),
    );
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      accept: 'application/json, text/event-stream',
      authorization: 'Bearer ' + tokens.access_token,
      'content-type': 'application/json',
      'mcp-session-id': 'example-session',
      'mcp-protocol-version': '2025-06-18',
    });
    return new Response(stream.readable, {
      headers: {
        'content-type': 'text/event-stream',
        'mcp-session-id': 'example-session',
        'mcp-protocol-version': '2025-06-18',
        'set-cookie': 'ignored=1',
        'www-authenticate': 'ignored',
      },
    });
  });

  const result = await kahoot.mcp(
    post(messages, {
      accept: 'application/json, text/event-stream',
      'mcp-session-id': 'example-session',
      'mcp-protocol-version': '2025-06-18',
      'x-crudex-kahoot-token': 'fixture-sandbox-credential',
      cookie: 'ignored=1',
    }),
  );
  expect(result.status).toBe(200);
  expect(Object.fromEntries(result.headers)).toEqual({
    'content-type': 'text/event-stream',
    'mcp-session-id': 'example-session',
    'mcp-protocol-version': '2025-06-18',
  });
  const reader = result.body!.getReader();
  const writer = stream.writable.getWriter();
  const frame = new TextEncoder().encode('data: {"jsonrpc":"2.0"}\n\n');
  const write = writer.write(frame);
  expect(await reader.read()).toEqual({ done: false, value: frame });
  await write;
  await writer.close();
  expect(await reader.read()).toMatchObject({ done: true });
});

it('rejects updates, unknown tools, mixed batches and oversized or malformed bodies before forwarding', async () => {
  const kahoot = await connected();
  fetchMock.mockClear();
  for (const body of [
    rpc('tools/call', { name: 'create_or_update_kahoot', arguments: { uuid: null } }),
    rpc('tools/call', { name: 'publish_kahoot' }),
    [rpc('ping'), rpc('resources/list')],
    rpc('ping', { text: 'a'.repeat(256 * 1024) }),
    'not a JSON-RPC object',
    [],
  ]) {
    const result = await kahoot.mcp(post(body));
    expect(result.status).toBe(403);
    expect(await result.json()).toMatchObject({
      jsonrpc: '2.0',
      error: { code: expect.any(Number) },
    });
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it('retries a rejected buffered MCP request once with the refreshed token', async () => {
  const kahoot = await connected();
  fetchMock
    .mockReset()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ access_token: 'fixture-retry', expires_in: 120 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }));

  expect((await kahoot.mcp(post(rpc('ping')))).status).toBe(401);
  const [initial, refresh, retry] = fetchMock.mock.calls;
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(String(refresh?.[0])).toBe(issuer + '/token');
  expect(String(retry?.[0])).toBe(resource);
  expect(retry?.[1]?.body).toEqual(initial?.[1]?.body);
  expect(new Headers(retry?.[1]?.headers).get('authorization')).toBe('Bearer fixture-retry');
});

it('forwards bodyless GET and DELETE requests and reports a disconnected account', async () => {
  const kahoot = kahootConnection();
  const request = (method: string) => new Request(origin + '/__kahoot/mcp', { method });
  const response = await kahoot.mcp(request('GET'));
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'kahoot_not_connected' });
  expect(fetchMock).not.toHaveBeenCalled();

  const active = await connected();
  fetchMock.mockClear().mockImplementation(async (_url, init) => {
    expect(init?.body).toBeUndefined();
    return new Response(null, { status: 204 });
  });
  expect((await active.mcp(request('GET'))).status).toBe(204);
  expect((await active.mcp(request('DELETE'))).status).toBe(204);
  expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['GET', 'DELETE']);
});
