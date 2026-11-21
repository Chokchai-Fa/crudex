import {
  runEventSchema,
  type RunEvent,
  type AgentId,
  type CreateRun,
  type SchoolActor,
} from '@repo/shared';
import { z } from 'zod';
import { ConflictError, ForbiddenError, NotFoundError, RateLimitError } from '../lib/errors';
import * as repo from '../repositories/runs.repository';
import type { Deps } from '../types/deps';
import { loadSchoolActor } from './identity.service';

function authorize(actor: SchoolActor, agentId: AgentId, classId?: string | null) {
  const principal = agentId === 'lekha_por' || agentId === 'rungchao';
  if (
    actor.role !== (principal ? 'principal' : 'teacher') ||
    (classId && !actor.classes.some((c) => c.id === classId))
  )
    throw new ForbiddenError();
}
type Run = Awaited<ReturnType<typeof repo.accept>>;
function dto({ id, agentId, classId, prompt, status, createdAt }: Run) {
  return { id, agentId, classId, prompt, status, createdAt: createdAt.toISOString() };
}
export async function startRun(deps: Deps, a: SchoolActor, agent: AgentId, input: CreateRun) {
  authorize(a, agent, input.classId);
  const id = crypto.randomUUID();
  const run = await repo
    .accept(deps.db, a, a.role === 'principal' ? 'principal' : 'teacher', agent, input, id)
    .catch((e: unknown) => {
      const cause = e instanceof Error && e.cause ? e.cause : e;
      if (cause instanceof Error && /(school|owner)_daily_run_limit/.test(cause.message))
        throw new RateLimitError();
      throw e;
    });
  if (
    run.membershipId !== a.membershipId ||
    run.agentId !== agent ||
    run.prompt !== input.prompt ||
    run.classId !== (input.classId ?? null)
  )
    throw new ConflictError('Request ID already used');
  if (run.id === id && run.status === 'queued')
    await deps.queue.enqueue({ type: 'dispatch-run', runId: run.id }).catch(() => undefined);
  return dto(run);
}
export async function ownedRun(deps: Deps, a: SchoolActor, id: string) {
  const run = await repo.owned(deps.db, a, id);
  if (!run) throw new NotFoundError();
  authorize(a, run.agentId, run.classId);
  return run;
}
export async function runHistory(deps: Deps, a: SchoolActor, agent: AgentId) {
  authorize(a, agent);
  const rows = await repo.history(deps.db, a, agent);
  return {
    runs: rows
      .filter((r) => !r.classId || a.classes.some((c) => c.id === r.classId))
      .map((r) => ({ ...dto(r), worksheetIds: r.worksheetIds })),
  };
}
export async function replay(deps: Deps, a: SchoolActor, id: string, cursor: number) {
  const run = await ownedRun(deps, a, id);
  const events = await repo.events(deps.db, id, cursor);
  const terminal = run.status !== 'queued' && run.status !== 'running';
  return { events, terminal };
}
async function digest(token: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function authorizeRunTool(deps: Deps, id: string, token: string) {
  if (!/^[a-f0-9-]{72}$/.test(token)) throw new ForbiddenError();
  const run = await repo.credential(deps.db, id, await digest(token));
  if (!run) throw new ForbiddenError();
  authorize(await loadSchoolActor(deps, run), run.agentId, run.classId);
  return run;
}
export async function recoverRuns(deps: Deps) {
  await repo.expire(deps.db);
  for (const row of await repo.pending(deps.db))
    await deps.queue.enqueue({ type: 'dispatch-run', runId: row.runId });
}
const gatewayEventSchema = z.union([
  runEventSchema,
  z.object({ type: z.literal('progress'), messageId: z.string().min(1) }),
]);
async function* readStream(body: ReadableStream<Uint8Array>): AsyncGenerator<RunEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true });
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!frame.startsWith('data: ')) continue;
        const value: unknown = JSON.parse(frame.slice(6));
        const parsed = gatewayEventSchema.safeParse(value);
        if (!parsed.success) continue;
        const event = parsed.data;
        // An empty delta preserves the cursor and remains readable by older classroom clients.
        if (event.type === 'progress') {
          yield { type: 'delta', text: '', messageId: event.messageId, interim: true };
        } else {
          yield event;
        }
      }
      if (buffer.length > 256_000) throw new Error('Invalid stream');
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
const historyTurns = 6;
const historyChars = 600;
const clip = (t: string) => (t.length > historyChars ? t.slice(0, historyChars) + '…' : t);
/** The gateway keeps no reliable session, so each turn carries the recent conversation with it. */
async function withHistory(
  deps: Deps,
  run: Parameters<typeof repo.recentTurns>[1] & { prompt: string },
) {
  const turns = await repo.recentTurns(deps.db, run, historyTurns);
  const room = run.classId
    ? (await loadSchoolActor(deps, run)).classes.find((c) => c.id === run.classId)?.name
    : undefined;
  if (!turns.length && !room) return run.prompt;
  const lines = ['บทสนทนาก่อนหน้า (ใช้เป็นบริบท ไม่ต้องถามซ้ำสิ่งที่ครูบอกแล้ว):'];
  if (room) lines.push(`ห้องที่เลือก: ${room}`);
  for (const t of turns) lines.push(`ครู: ${clip(t.prompt)}`, `ผู้ช่วย: ${clip(t.reply.trim())}`);
  return `${lines.join('\n')}\n\nข้อความใหม่จากครู:\n${run.prompt}`;
}
export async function dispatchRun(deps: Deps, id: string) {
  const attempt = crypto.randomUUID(),
    token = crypto.randomUUID() + crypto.randomUUID();
  const run = await repo.claim(deps.db, id, attempt, await digest(token));
  if (!run) return;
  let buffered: RunEvent[] = [];
  let lastFlush = Date.now();
  async function flush() {
    if (!buffered.length) return;
    await repo.append(deps.db, id, attempt, buffered);
    buffered = [];
    lastFlush = Date.now();
  }
  try {
    authorize(await loadSchoolActor(deps, run), run.agentId, run.classId);
    if (!deps.agentGateway) throw new Error('Gateway unavailable');
    const gateway = new URL(deps.config.APP_URL);
    gateway.hostname = gateway.hostname.replace(/^[^.]+/, 'crudex-agent');
    // History is context only; a failed lookup must not block the turn.
    const text = await withHistory(deps, run).catch(() => run.prompt);
    const previous = await repo.previousStatus(deps.db, run);
    const freshSession =
      previous === 'failed' || previous === 'interrupted' || previous === 'cancelled';
    const res = await deps.agentGateway.fetch(new URL('/dispatch', gateway), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agentId: run.agentId,
        text,
        scope: {
          schoolId: run.schoolId,
          ownerId: run.ownerId,
          role: run.role,
          freshSession,
          classId: run.classId,
          runId: id,
          attemptId: attempt,
          agentId: run.agentId,
          expiresAt: run.leaseUntil!.getTime(),
          callbackOrigin: deps.config.APP_URL,
          credential: token,
        },
      }),
    });
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      const uncertain = res.status >= 500;
      const code =
        res.status === 429 ? 'capacity_exhausted' : uncertain ? 'interrupted' : 'dispatch_denied';
      await repo.finish(deps.db, id, attempt, uncertain ? 'interrupted' : 'failed', {
        type: 'error',
        code,
      });
      return;
    }
    for await (const e of readStream(res.body)) {
      if (e.type === 'done' || e.type === 'error') {
        await flush();
        await repo.finish(deps.db, id, attempt, e.type === 'done' ? 'succeeded' : 'failed', e);
        return;
      }
      const previous = buffered.at(-1);
      if (
        previous?.type === 'delta' &&
        e.type === 'delta' &&
        previous.messageId === e.messageId &&
        !previous.interim &&
        !e.interim
      ) {
        previous.text += e.text;
      } else {
        buffered.push(e);
      }
      if (Date.now() - lastFlush >= 10_000 || buffered.length >= 64) await flush();
    }
  } catch {
    /* A disconnect after dispatch has an uncertain outcome. */
  }
  await flush();
  await repo.finish(deps.db, id, attempt, 'interrupted', { type: 'error', code: 'interrupted' });
}

export async function cancelRun(deps: Deps, a: SchoolActor, id: string) {
  await ownedRun(deps, a, id);
  await repo.cancel(deps.db, id, a);
  return dto(await ownedRun(deps, a, id));
}
