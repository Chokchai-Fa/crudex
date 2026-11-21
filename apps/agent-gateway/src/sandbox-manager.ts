import { loginIdHeader, validLoginId } from './gate';
import { dispatchSchema, signedTurn } from '../../../packages/shared/src/school-dispatch.schema';
import { DurableObject } from 'cloudflare:workers';
import { consumeRun, countToday, dailyRunLimit, type DailyUsage } from './daily-cap';
import { envSchema, type AgentConfig } from './env';
import { isKahootMcpRequest, kahootTokenHeader } from './kahoot-mcp';
import { kahootInstanceName } from './kahoot-state';
import { restoreRuntimeState, saveRuntimeState } from './runtime-state';
import {
  archivePath,
  bootSandbox,
  createSandbox,
  randomToken,
  rotateAfter,
  sandboxTimeout,
  stopSandbox,
  upstreamHeader,
} from './sandbox';

interface SandboxRecord {
  owner?: string;
  name: string;
  revision?: string;
  startedAt: number;
  lastUsedAt: number;
}

interface RunningSandbox extends SandboxRecord {
  url: string;
  token: string;
  kahootToken?: string;
}

const retryAlarmAfter = 60_000;
const encoder = new TextEncoder();

export class SandboxManager extends DurableObject<Env> {
  private sandbox?: SandboxRecord | RunningSandbox;
  private transition?: Promise<void>;
  private activeRequests = 0;
  private drained?: () => void;
  private checkpoint = Promise.resolve();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.sandbox = await ctx.storage.get<RunningSandbox | SandboxRecord>('sandbox');
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === archivePath) return this.serveArchive(request);
    if (isKahootMcpRequest(url, request.method)) return this.serveKahoot(request);

    const config = envSchema.parse(this.env);
    if (request.method === 'GET' && url.pathname === '/api/status') {
      const usage = await this.ctx.storage.get<DailyUsage>('usage');
      const now = Date.now();
      return Response.json({
        sandbox:
          this.sandbox && 'url' in this.sandbox
            ? 'running'
            : this.transition
              ? 'starting'
              : 'stopped',
        runtimeRevision: this.sandbox?.revision,
        startedAt: this.sandbox?.startedAt,
        lastUsedAt: this.sandbox?.lastUsedAt,
        runsToday: countToday(usage, now),
        limit: dailyRunLimit(now, config.DAILY_RUN_LIMIT, config.DAILY_RUN_LIMIT_OVERRIDES),
      });
    }

    if (
      request.method === 'POST' &&
      (url.pathname === '/api/chat' || url.pathname === '/school/chat')
    ) {
      const loginId = request.headers.get(loginIdHeader);
      if (
        url.pathname === '/api/chat' &&
        !validLoginId(loginId) &&
        !(loginId === 'scheduled' && url.searchParams.get('role') === 'principal')
      ) {
        return Response.json({ error: 'invalid_session' }, { status: 401 });
      }
      const admitted = await this.ctx.storage.transaction(async (txn) => {
        const usage = await txn.get<DailyUsage>('usage');
        const now = Date.now();
        const limit = dailyRunLimit(now, config.DAILY_RUN_LIMIT, config.DAILY_RUN_LIMIT_OVERRIDES);
        const next = consumeRun(usage, now, limit);
        if (next) await txn.put('usage', next);
        return next !== null;
      });
      if (!admitted) return Response.json({ error: 'daily_limit' }, { status: 429 });
      const owner =
        url.pathname === '/school/chat' ? request.headers.get('x-school-owner') : undefined;
      if (owner === null) return new Response(null, { status: 403 });
      return this.proxy(request, config, '/chat', owner);
    }
    if (request.method === 'GET' && url.pathname === '/api/agents') {
      return this.proxy(request, config, '/agents');
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  private async serveArchive(request: Request) {
    const token = request.headers.get(upstreamHeader);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 401 });
    const authorized = await this.ctx.storage.transaction(async (txn) => {
      const expected = await txn.get<string>('boot-token');
      if (
        !expected ||
        !crypto.subtle.timingSafeEqual(encoder.encode(token), encoder.encode(expected))
      ) {
        return false;
      }
      await txn.delete('boot-token');
      return true;
    });
    if (!authorized) return new Response(null, { status: 401 });
    const asset = await this.env.ASSETS.fetch(new Request(new URL(archivePath, request.url)));
    return new Response(asset.body, {
      status: asset.status,
      headers: { 'content-type': 'application/gzip', 'cache-control': 'no-store' },
    });
  }

  private async serveKahoot(request: Request) {
    const sandbox = this.sandbox;
    const token = request.headers.get(kahootTokenHeader);
    if (
      !sandbox ||
      !('url' in sandbox) ||
      !sandbox.kahootToken ||
      Date.now() >= sandbox.startedAt + sandboxTimeout ||
      !token ||
      !/^[a-f0-9]{64}$/.test(token) ||
      !crypto.subtle.timingSafeEqual(encoder.encode(token), encoder.encode(sandbox.kahootToken))
    ) {
      return new Response(null, { status: 401 });
    }
    return this.env.KAHOOT.getByName(kahootInstanceName(sandbox.owner)).mcp(request);
  }

  private async proxy(
    request: Request,
    config: AgentConfig,
    path: '/chat' | '/agents',
    owner?: string,
  ) {
    let acquired = false;
    try {
      const sandbox = await this.acquire(new URL(request.url).origin, config, owner);
      acquired = true;
      const headers = new Headers({ [upstreamHeader]: sandbox.token });
      if (path === '/chat') {
        headers.set('content-type', 'application/json');
        if (!owner) headers.set(loginIdHeader, request.headers.get(loginIdHeader)!);
      }

      let body: ReadableStream<Uint8Array> | string | null = request.body;
      if (owner) {
        const turn = dispatchSchema.parse(await request.json());
        if (turn.scope.expiresAt <= Date.now())
          return Response.json({ error: 'expired_attempt' }, { status: 403 });
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(sandbox.token),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign'],
        );
        const signature = await crypto.subtle.sign(
          'HMAC',
          key,
          encoder.encode(signedTurn(turn.scope, turn.text)),
        );
        headers.set(
          'x-school-signature',
          Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join(''),
        );
        body = JSON.stringify(turn);
      }
      const url = new URL(path, sandbox.url);
      const role = new URL(request.url).searchParams.get('role');
      if (role !== null) url.searchParams.set('role', role);
      // Allow the five-minute runtime turn to finish and flush its final SSE event.
      const proxyTimeout = path === '/chat' ? 310_000 : 130_000;
      const upstream = await fetch(url, {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(proxyTimeout)]),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        await upstream.body?.cancel();
        throw new Error('Unexpected runtime redirect');
      }
      // Keep the sandbox in use through streaming and the chat checkpoint.
      const stream = upstream.body && new TransformStream<Uint8Array, Uint8Array>();
      const finished =
        stream && upstream.body ? upstream.body.pipeTo(stream.writable) : Promise.resolve();
      this.ctx.waitUntil(
        finished
          .then(() => {
            if (path !== '/chat') return;
            // Serialize checkpoints so an older fetch cannot overwrite a newer snapshot.
            this.checkpoint = this.checkpoint.then(() =>
              saveRuntimeState(this.ctx.storage, sandbox),
            );
            return this.checkpoint;
          })
          .catch(() => undefined)
          .finally(() => this.release()),
      );
      acquired = false;
      return stream
        ? new Response(stream.readable, { status: upstream.status, headers: upstream.headers })
        : upstream;
    } catch {
      return Response.json({ error: 'sandbox_unavailable' }, { status: 503 });
    } finally {
      if (acquired) this.release();
    }
  }

  private async acquire(
    origin: string,
    config: AgentConfig,
    owner?: string,
  ): Promise<RunningSandbox> {
    if (this.transition) await this.transition;
    const current = this.sandbox;
    if (
      !current ||
      !('url' in current) ||
      current.owner !== owner ||
      current.revision !== config.RUNTIME_REVISION ||
      Boolean(current.kahootToken) !== (config.KAHOOT_MCP_ENABLED === 'true') ||
      Date.now() >= current.startedAt + rotateAfter
    ) {
      await this.beginTransition(() => this.replace(origin, config, owner));
      return this.acquire(origin, config, owner);
    }

    this.activeRequests++;
    const used = { ...current, lastUsedAt: Date.now() };
    this.sandbox = used;
    try {
      await this.ctx.storage.put('sandbox', used);
      return used;
    } catch (error) {
      this.release();
      throw error;
    }
  }

  private release() {
    if (--this.activeRequests === 0) {
      this.drained?.();
      this.drained = undefined;
    }
  }

  private beginTransition(work: () => Promise<void>) {
    this.transition ??= work().finally(() => {
      this.transition = undefined;
    });
    return this.transition;
  }

  private async replace(origin: string, config: AgentConfig, owner?: string) {
    if (this.activeRequests)
      await new Promise<void>((resolve) => {
        this.drained = resolve;
      });
    await this.retire(config);
    const sandbox = await createSandbox(config);
    const startedAt = sandbox.createdAt.getTime();
    const record = {
      owner,
      name: sandbox.name,
      revision: config.RUNTIME_REVISION,
      startedAt,
      lastUsedAt: startedAt,
    };
    this.sandbox = record;

    try {
      const bootToken = randomToken();
      const token = randomToken();
      const kahootToken = config.KAHOOT_MCP_ENABLED === 'true' ? randomToken() : undefined;
      await this.ctx.storage.setAlarm(Date.now() + retryAlarmAfter);
      await this.ctx.storage.put({ sandbox: record, 'boot-token': bootToken });
      const url = await bootSandbox(sandbox, config, origin, bootToken, token, owner, kahootToken);
      const running = { ...record, url, token, kahootToken, lastUsedAt: Date.now() };
      // A bad or unreadable snapshot must not keep the sandbox from serving; it starts empty instead.
      await restoreRuntimeState(this.ctx.storage, running).catch((error: unknown) => {
        console.warn(
          'runtime_state_restore_failed',
          error instanceof Error ? error.message : error,
        );
      });
      await this.ctx.storage.put('sandbox', running);
      this.sandbox = running;
      await this.ctx.storage.setAlarm(this.idleDeadline(running, config));
    } catch (error) {
      await this.retire(config).catch(() => undefined);
      throw error;
    } finally {
      await this.ctx.storage.delete('boot-token');
    }
  }

  private async retire(config: AgentConfig) {
    const sandbox = this.sandbox;
    if (!sandbox) return;

    if (Date.now() < sandbox.startedAt + sandboxTimeout) {
      try {
        if ('url' in sandbox) await saveRuntimeState(this.ctx.storage, sandbox);
        await stopSandbox(config, sandbox.name);
      } catch (error) {
        await this.ctx.storage.setAlarm(Date.now() + retryAlarmAfter);
        throw error;
      }
    }
    await this.ctx.storage.delete(['sandbox', 'boot-token']);
    this.sandbox = undefined;
  }

  private idleDeadline(sandbox: SandboxRecord, config: AgentConfig) {
    return Math.min(
      sandbox.lastUsedAt + config.IDLE_STOP_MINUTES * 60_000,
      sandbox.startedAt + rotateAfter,
    );
  }

  override async alarm() {
    if (!this.sandbox) return;
    if (this.transition || this.activeRequests) {
      await this.ctx.storage.setAlarm(Date.now() + retryAlarmAfter);
      return;
    }
    const config = envSchema.parse(this.env);
    const deadline = this.idleDeadline(this.sandbox, config);
    if ('url' in this.sandbox && Date.now() < deadline) {
      await this.ctx.storage.setAlarm(deadline);
      return;
    }
    await this.beginTransition(() => this.retire(config));
  }
}
