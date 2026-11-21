import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import type { KahootStatus } from '../../../packages/shared/src/school-dispatch.schema';
import {
  forwardKahootMcp,
  isKahootMcpRequest,
  kahootMcpResponse,
  kahootResource,
  readKahootMcpBody,
} from './kahoot-mcp';
import { kahootState, parseKahootState } from './kahoot-state';
import { randomToken } from './sandbox';

const issuer = 'https://mcp.kahoot.it';
const scope = 'openid offline_access';
const stateLifetime = 10 * 60_000;
const refreshAhead = 60_000;

const registrationSchema = z.object({
  client_id: z.string().min(1),
  client_secret: z.string().min(1).optional(),
});

const tokenSchema = z.object({
  access_token: z.string().regex(/^[A-Za-z0-9._~+/-]+=*$/),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
});
const invalidGrantSchema = z.object({ error: z.literal('invalid_grant') });

interface Client {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
}

interface PendingAuthorization extends Client {
  codeVerifier: string;
  createdAt: number;
}

interface Grant {
  id: string;
  client: Client;
  tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresAt: number;
    connectedAt: number;
  };
}

function oauthFetch(path: '/register' | '/token' | '/revoke', body: string | URLSearchParams) {
  return fetch(issuer + path, {
    method: 'POST',
    headers: {
      'content-type':
        typeof body === 'string' ? 'application/json' : 'application/x-www-form-urlencoded',
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
}

function clientForm(client: Client, values: Record<string, string>) {
  const form = new URLSearchParams({ ...values, client_id: client.clientId });
  if (client.clientSecret) form.set('client_secret', client.clientSecret);
  return form;
}

async function exchange(client: Client, values: Record<string, string>) {
  const response = await oauthFetch(
    '/token',
    clientForm(client, { ...values, resource: kahootResource }),
  );
  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    const tokens = tokenSchema.safeParse(body);
    if (tokens.success) return { kind: 'success', value: tokens.data } as const;
  } else if (invalidGrantSchema.safeParse(body).success) {
    return { kind: 'invalid_grant' } as const;
  }
  throw new Error('Kahoot token exchange failed');
}

function issuedTokens(value: z.infer<typeof tokenSchema>, previous?: Grant['tokens']) {
  const now = Date.now();
  return {
    accessToken: value.access_token,
    refreshToken: value.refresh_token ?? previous?.refreshToken,
    expiresAt: now + value.expires_in * 1000,
    connectedAt: previous?.connectedAt ?? now,
  };
}

function notConnected() {
  return Response.json({ error: 'kahoot_not_connected' }, { status: 401 });
}

export class KahootConnection extends DurableObject<Env> {
  #queue: Promise<unknown> = Promise.resolve();
  #refreshing?: { id: string; promise: Promise<Grant | undefined> };

  #serialize<T>(operation: () => Promise<T>) {
    const result = this.#queue.then(operation);
    this.#queue = result.catch(() => undefined);
    return result;
  }

  async beginAuthorization(redirectUri: string) {
    const name = this.ctx.id.name;
    if (!name) throw new Error('Kahoot connection must be named');
    return this.#serialize(async () => {
      const storage = this.ctx.storage;
      let client = await storage.get<Client>('client');
      if (client?.redirectUri !== redirectUri) {
        const response = await oauthFetch(
          '/register',
          JSON.stringify({
            client_name: 'Crudex School Bot',
            redirect_uris: [redirectUri],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'client_secret_post',
            scope,
          }),
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error('Kahoot client registration failed');
        }
        const registration = registrationSchema.safeParse(
          await response.json().catch(() => undefined),
        );
        if (!registration.success) throw new Error('Kahoot client registration failed');
        client = {
          clientId: registration.data.client_id,
          clientSecret: registration.data.client_secret,
          redirectUri,
        };
        await storage.put('client', client);
      }

      const nonce = randomToken();
      const codeVerifier = randomToken();
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
      const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replaceAll('+', '-')
        .replaceAll('/', '_')
        .replaceAll('=', '');

      const now = Date.now();
      const pending = await storage.get<Record<string, PendingAuthorization>>('pending');
      const recent = Object.entries(pending ?? {})
        .filter(([, entry]) => entry.createdAt > now - stateLifetime)
        .slice(-7);
      await storage.put('pending', {
        ...Object.fromEntries(recent),
        [nonce]: { ...client, codeVerifier, createdAt: now },
      });

      const url = new URL('/authorize', issuer);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: client.clientId,
        redirect_uri: redirectUri,
        scope,
        state: kahootState(name, nonce),
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: kahootResource,
      }).toString();
      return url.href;
    });
  }

  async callback(code: string | null, state: string) {
    const parsed = parseKahootState(state);
    if (!parsed || parsed.name !== this.ctx.id.name) return false;
    const { nonce } = parsed;

    return this.#serialize(async () => {
      const storage = this.ctx.storage;
      const pending = await storage.get<Record<string, PendingAuthorization>>('pending');
      const attempt = pending?.[nonce];
      if (!attempt || !pending) return false;
      delete pending[nonce];
      await storage.put('pending', pending);

      const { codeVerifier, createdAt, ...client } = attempt;
      if (!code || createdAt <= Date.now() - stateLifetime) return false;
      const result = await exchange(client, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: client.redirectUri,
        code_verifier: codeVerifier,
      });
      if (result.kind !== 'success') return false;
      await storage.put<Grant>('grant', { id: nonce, client, tokens: issuedTokens(result.value) });
      return true;
    });
  }

  async status(): Promise<KahootStatus> {
    const grant = await this.ctx.storage.get<Grant>('grant');
    if (!grant || (!grant.tokens.refreshToken && grant.tokens.expiresAt <= Date.now()))
      return { connected: false };
    const { connectedAt, expiresAt } = grant.tokens;
    return { connected: true, connectedAt, expiresAt };
  }

  async disconnect() {
    await this.#serialize(async () => {
      const grant = await this.ctx.storage.get<Grant>('grant');
      if (!grant) return;
      await this.ctx.storage.delete('grant');
      const { refreshToken, accessToken } = grant.tokens;
      for (const [token, tokenType] of [
        [refreshToken, 'refresh_token'],
        [accessToken, 'access_token'],
      ] as const) {
        if (!token) continue;
        const form = clientForm(grant.client, { token, token_type_hint: tokenType });
        await oauthFetch('/revoke', form)
          .then((response) => response.body?.cancel())
          .catch(() => undefined);
      }
    });
  }

  async #accessToken() {
    const grant = await this.ctx.storage.get<Grant>('grant');
    if (!grant) return;
    const { expiresAt, refreshToken } = grant.tokens;
    const now = Date.now();
    if (refreshToken && expiresAt <= now + refreshAhead) return this.#refresh(grant);
    if (expiresAt > now) return grant;
  }

  #refresh(previous: Grant) {
    if (this.#refreshing?.id === previous.id) return this.#refreshing.promise;
    const promise = this.#serialize(async () => {
      const storage = this.ctx.storage;
      const grant = await storage.get<Grant>('grant');
      if (grant?.id !== previous.id) return;
      const { accessToken, expiresAt, refreshToken } = grant.tokens;
      if (accessToken !== previous.tokens.accessToken || expiresAt !== previous.tokens.expiresAt)
        return grant;
      if (!refreshToken) return;
      const result = await exchange(grant.client, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      if (result.kind === 'invalid_grant') {
        await storage.delete('grant');
        return;
      }
      const renewed = { ...grant, tokens: issuedTokens(result.value, grant.tokens) };
      await storage.put('grant', renewed);
      return renewed;
    }).finally(() => {
      if (this.#refreshing?.promise === promise) this.#refreshing = undefined;
    });
    this.#refreshing = { id: previous.id, promise };
    return promise;
  }

  async mcp(request: Request) {
    if (!isKahootMcpRequest(new URL(request.url), request.method))
      return new Response(null, { status: 404 });
    const body = await readKahootMcpBody(request);
    if (body === undefined) {
      return Response.json(
        { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'MCP request forbidden' } },
        { status: 403 },
      );
    }
    try {
      const grant = await this.#accessToken();
      if (!grant) return notConnected();
      const upstream = await forwardKahootMcp(request, body, grant.tokens.accessToken);
      if (upstream.status !== 401 || !grant.tokens.refreshToken) return kahootMcpResponse(upstream);

      void upstream.body?.cancel().catch(() => undefined);
      const renewed = await this.#refresh(grant);
      if (!renewed) return notConnected();
      return kahootMcpResponse(await forwardKahootMcp(request, body, renewed.tokens.accessToken));
    } catch {
      return Response.json({ error: 'kahoot_unavailable' }, { status: 502 });
    }
  }
}
