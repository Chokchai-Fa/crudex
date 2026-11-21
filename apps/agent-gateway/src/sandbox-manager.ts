import { loginIdHeader, validLoginId } from './gate';
import { DurableObject } from 'cloudflare:workers';
import { consumeRun, countToday, type DailyUsage } from './daily-cap';
import { envSchema, type AgentConfig } from './env';
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
  name: string;
  revision?: string;
  startedAt: number;
  lastUsedAt: number;
}

interface RunningSandbox extends SandboxRecord {
  url: string;
  token: string;
}

const retryAlarmAfter = 60_000;

export class SandboxManager extends DurableObject<Env> {
  private sandbox?: SandboxRecord | RunningSandbox;
  private transition?: Promise<void>;
  private activeRequests = 0;
  private drained?: () => void;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.sandbox = await ctx.storage.get<RunningSandbox | SandboxRecord>('sandbox');
    });
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === archivePath) return this.serveArchive(request);

    const config = envSchema.parse(this.env);
    if (request.method === 'GET' && url.pathname === '/api/status') {
      const usage = await this.ctx.storage.get<DailyUsage>('usage');
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
        runsToday: countToday(usage, Date.now()),
        limit: config.DAILY_RUN_LIMIT,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/chat') {
      const loginId = request.headers.get(loginIdHeader);
      if (
        !validLoginId(loginId) &&
        !(loginId === 'scheduled' && url.searchParams.get('role') === 'principal')
      ) {
        return Response.json({ error: 'invalid_session' }, { status: 401 });
      }
      const admitted = await this.ctx.storage.transaction(async (txn) => {
        const usage = await txn.get<DailyUsage>('usage');
        const next = consumeRun(usage, Date.now(), config.DAILY_RUN_LIMIT);
        if (next) await txn.put('usage', next);
        return next !== null;
      });
      if (!admitted) return Response.json({ error: 'daily_limit' }, { status: 429 });
      return this.proxy(request, config, '/chat');
    }
    if (request.method === 'GET' && url.pathname === '/api/agents') {
      return this.proxy(request, config, '/agents');
    }
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  private async serveArchive(request: Request) {
    const token = request.headers.get(upstreamHeader);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return new Response(null, { status: 401 });
    const encoder = new TextEncoder();
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

  private async proxy(request: Request, config: AgentConfig, path: '/chat' | '/agents') {
    let acquired = false;
    try {
      const sandbox = await this.acquire(new URL(request.url).origin, config);
      acquired = true;
      const headers = new Headers({ [upstreamHeader]: sandbox.token });
      if (path === '/chat') {
        headers.set('content-type', 'application/json');
        headers.set(loginIdHeader, request.headers.get(loginIdHeader)!);
      }

      const url = new URL(path, sandbox.url);
      const role = new URL(request.url).searchParams.get('role');
      if (role !== null) url.searchParams.set('role', role);
      // Allow the five-minute runtime turn to finish and flush its final SSE event.
      const proxyTimeout = path === '/chat' ? 310_000 : 130_000;
      const upstream = await fetch(url, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(proxyTimeout)]),
      });
      if (upstream.status >= 300 && upstream.status < 400) {
        await upstream.body?.cancel();
        throw new Error('Unexpected runtime redirect');
      }
      if (!upstream.body) return upstream;

      // Keep the sandbox in use until the response body finishes or the downstream cancels.
      const stream = new TransformStream<Uint8Array, Uint8Array>();
      this.ctx.waitUntil(
        upstream.body
          .pipeTo(stream.writable)
          .catch(() => undefined)
          .finally(() => this.release()),
      );
      acquired = false;
      return new Response(stream.readable, { status: upstream.status, headers: upstream.headers });
    } catch {
      return Response.json({ error: 'sandbox_unavailable' }, { status: 503 });
    } finally {
      if (acquired) this.release();
    }
  }

  private async acquire(origin: string, config: AgentConfig): Promise<RunningSandbox> {
    if (this.transition) await this.transition;
    const current = this.sandbox;
    if (
      !current ||
      !('url' in current) ||
      current.revision !== config.RUNTIME_REVISION ||
      Date.now() >= current.startedAt + rotateAfter
    ) {
      await this.beginTransition(() => this.replace(origin, config));
      return this.acquire(origin, config);
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

  private async replace(origin: string, config: AgentConfig) {
    if (this.activeRequests)
      await new Promise<void>((resolve) => {
        this.drained = resolve;
      });
    await this.retire(config);
    const sandbox = await createSandbox(config);
    const startedAt = sandbox.createdAt.getTime();
    const record = {
      name: sandbox.name,
      revision: config.RUNTIME_REVISION,
      startedAt,
      lastUsedAt: startedAt,
    };
    this.sandbox = record;

    try {
      const bootToken = randomToken();
      const token = randomToken();
      await this.ctx.storage.setAlarm(Date.now() + retryAlarmAfter);
      await this.ctx.storage.put({ sandbox: record, 'boot-token': bootToken });
      const url = await bootSandbox(sandbox, config, origin, bootToken, token);
      const running = { ...record, url, token, lastUsedAt: Date.now() };
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
