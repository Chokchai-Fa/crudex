import { runEventPageSize, type Handoff, type RecipientAgent } from '@repo/shared';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  lt,
  isNull,
  sql,
  or,
  exists,
  getTableColumns,
  inArray,
} from 'drizzle-orm';
import type {
  DelegatedKahoot,
  RunEvent,
  CreateRun,
  AgentId,
  RunStatus,
  SchoolActor,
} from '@repo/shared';
import { assessments } from '../db/schema/classroom';
import { ForbiddenError } from '../lib/errors';
import type { Db } from '../db/client';
import { agentRuns as runs, runEvents, runOutbox } from '../db/schema/runs';

export async function accept(
  db: Db,
  actor: SchoolActor,
  role: 'principal' | 'teacher',
  agentId: AgentId,
  input: CreateRun,
  id: string = crypto.randomUUID(),
) {
  await db.batch([
    db
      .insert(runs)
      .values({
        id,
        schoolId: actor.schoolId,
        ownerId: actor.ownerId,
        membershipId: actor.membershipId,
        role,
        agentId,
        classId: input.classId,
        requestId: input.clientRequestId,
        prompt: input.prompt,
      })
      .onConflictDoNothing(),
    db.execute(sql`insert into run_quota(day,used)
      select (now() at time zone 'Asia/Bangkok')::date,1 from agent_runs where id=${id}
      on conflict(day) do update set used=run_quota.used+1`),
    db.execute(sql`insert into owner_run_quota(day,owner_id,used)
      select (now() at time zone 'Asia/Bangkok')::date,owner_id,1 from agent_runs where id=${id}
      on conflict(day,owner_id) do update set used=owner_run_quota.used+1`),
    db.execute(sql`insert into run_outbox(run_id) select id from agent_runs where id=${id}`),
    db.execute(
      sql`insert into run_events(run_id,body) select id,'{"type":"status","status":"queued"}'::jsonb from agent_runs where id=${id}`,
    ),
  ]);
  const [run] = await db
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.schoolId, actor.schoolId),
        eq(runs.ownerId, actor.ownerId),
        eq(runs.requestId, input.clientRequestId),
      ),
    );
  return run!;
}

export const ownerScope = (a: SchoolActor) =>
  and(
    eq(runs.schoolId, a.schoolId),
    eq(runs.ownerId, a.ownerId),
    eq(runs.membershipId, a.membershipId),
  );
export async function owned(db: Db, a: SchoolActor, id: string) {
  return (
    await db
      .select()
      .from(runs)
      .where(and(eq(runs.id, id), ownerScope(a)))
  )[0];
}
export function history(db: Db, a: SchoolActor, agentId: AgentId) {
  const artifacts = db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.schoolId, runs.schoolId), eq(assessments.runId, runs.id)));
  return db
    .select({ ...getTableColumns(runs), worksheetIds: sql<string[]>`array(${artifacts})` })
    .from(runs)
    .where(
      and(
        ownerScope(a),
        or(
          eq(runs.agentId, agentId),
          agentId === 'jum' ? and(eq(runs.agentId, 'jaew'), exists(artifacts)) : undefined,
        ),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(100);
}
/** One status per actual delegation. Neither the child session nor the original tool ID is public. */
export async function recipientHandoffs(
  db: Db,
  actor: SchoolActor,
  classId: string,
  recipient: RecipientAgent,
) {
  const result = await db.execute<Handoff>(sql`
    with activities as (
      select r.id as parent_id, r.prompt, r.created_at, e.id as sequence,
        e.body->>'id' as activity, e.body->>'agentId' as recipient,
        case when e.body->>'name'='subagent_return' then 'returned'
          else e.body->>'status' end as phase
      from agent_runs r join run_events e on e.run_id=r.id
      where r.school_id=${actor.schoolId} and r.owner_id=${actor.ownerId}
        and r.membership_id=${actor.membershipId} and r.class_id=${classId}
        and r.role='teacher' and r.agent_id='jaew'
        and e.body->>'type'='tool' and e.body->>'agentId'=${recipient} and e.body->>'id'<>''
        and ((e.body->>'name'='subagent' and e.body->>'status' in ('started','success','failed'))
          or (e.body->>'name'='subagent_return' and e.body->>'status'='success'))
    )
    select parent_id as "parentRunId", 'handoff-' || min(sequence) as "handoffId",
      recipient as "agentId", (array_agg(phase order by sequence desc))[1] as status,
      prompt, to_char(created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "createdAt"
    from activities group by parent_id,activity,recipient,prompt,created_at
    having bool_or(phase='started')
    order by max(sequence) desc limit 100`);
  return result.rows;
}
export function events(db: Db, runId: string, cursor: number) {
  return db
    .select({ id: runEvents.id, body: runEvents.body })
    .from(runEvents)
    .where(and(eq(runEvents.runId, runId), gt(runEvents.id, cursor)))
    .orderBy(asc(runEvents.id))
    .limit(runEventPageSize);
}
export async function claim(db: Db, id: string, attemptId: string, credentialHash: string) {
  const [rows] = await db.batch([
    db
      .update(runs)
      .set({
        attemptId,
        credentialHash,
        status: 'running',
        leaseUntil: sql`now()+interval '12 minutes'`,
      })
      .where(and(eq(runs.id, id), eq(runs.status, 'queued')))
      .returning(),
    db.execute(
      sql`insert into run_events(run_id,body) select id,'{"type":"status","status":"running"}'::jsonb from agent_runs where id=${id} and attempt_id=${attemptId}`,
    ),
    db.delete(runOutbox).where(eq(runOutbox.runId, id)),
  ]);
  return rows[0];
}
export async function append(db: Db, id: string, attempt: string, bodies: RunEvent[]) {
  await db.execute(
    sql`insert into run_events(run_id,body) select id, item from (select id from agent_runs where id=${id} and attempt_id=${attempt} and status='running' and lease_until>now() for update) active cross join jsonb_array_elements(${JSON.stringify(bodies)}::jsonb) with ordinality as events(item, seq) order by seq`,
  );
}
export async function finish(
  db: Db,
  id: string,
  attempt: string,
  status: RunStatus,
  body: RunEvent,
) {
  await db.execute(sql`with finished as (update agent_runs set status=${status},credential_hash=null where id=${id} and attempt_id=${attempt} and status='running' and lease_until>now() returning id)
    insert into run_events(run_id,body) select id,${JSON.stringify(body)}::jsonb from finished`);
}
export async function expire(db: Db) {
  await db.execute(sql`with expired as (update agent_runs set status='interrupted',credential_hash=null where status='running' and lease_until<=now() returning id)
    insert into run_events(run_id,body) select id,'{"type":"error","code":"interrupted"}'::jsonb from expired`);
}
export async function pending(db: Db) {
  return db.select().from(runOutbox).limit(60);
}
export async function credential(db: Db, id: string, hash: string) {
  return (
    await db
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.id, id),
          eq(runs.status, 'running'),
          eq(runs.credentialHash, hash),
          gt(runs.leaseUntil, new Date()),
        ),
      )
  )[0];
}

export async function cancel(db: Db, id: string, a: SchoolActor) {
  await db.execute(sql`with stopped as (update agent_runs set status='cancelled',credential_hash=null where id=${id} and owner_id=${a.ownerId} and membership_id=${a.membershipId} and school_id=${a.schoolId} and status in ('queued','running') returning id)
    insert into run_events(run_id,body) select id,'{"type":"error","code":"cancelled"}'::jsonb from stopped`);
}

export async function previousStatus(db: Db, run: typeof runs.$inferSelect) {
  const [previous] = await db
    .select({ status: runs.status })
    .from(runs)
    .where(
      and(
        eq(runs.membershipId, run.membershipId),
        eq(runs.agentId, run.agentId),
        run.classId ? eq(runs.classId, run.classId) : isNull(runs.classId),
        lt(runs.createdAt, run.createdAt),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(1);
  return previous?.status;
}

/** Earlier succeeded turns of the same owner, agent and room, oldest first, with the agent's final text. */
export async function recentTurns(
  db: Db,
  run: {
    id: string;
    schoolId: string;
    ownerId: string;
    agentId: AgentId;
    classId: string | null;
    createdAt: Date;
  },
  limit: number,
) {
  const rows = await db
    .select({ id: runs.id, prompt: runs.prompt })
    .from(runs)
    .where(
      and(
        eq(runs.schoolId, run.schoolId),
        eq(runs.ownerId, run.ownerId),
        eq(runs.agentId, run.agentId),
        run.classId ? eq(runs.classId, run.classId) : isNull(runs.classId),
        eq(runs.status, 'succeeded'),
        lt(runs.createdAt, run.createdAt),
      ),
    )
    .orderBy(desc(runs.createdAt))
    .limit(limit);
  if (!rows.length) return [];
  const bodies = await db
    .select({ runId: runEvents.runId, body: runEvents.body })
    .from(runEvents)
    .where(
      and(
        inArray(
          runEvents.runId,
          rows.map((r) => r.id),
        ),
        sql`${runEvents.body}->>'type' = 'delta'`,
      ),
    )
    .orderBy(asc(runEvents.id));
  return rows.reverse().map((r) => {
    const deltas = bodies.flatMap((b) =>
      b.runId === r.id && b.body.type === 'delta' ? [b.body] : [],
    );
    const interim = new Set(deltas.filter((d) => d.interim).map((d) => d.messageId));
    return {
      prompt: r.prompt,
      reply: deltas
        .filter((d) => !interim.has(d.messageId))
        .map((d) => d.text)
        .join(''),
    };
  });
}

/** Materialize a finished child turn and its replay in one statement on the live parent's lease. */
export async function saveDelegatedKahoot(
  db: Db,
  parentId: string,
  attempt: string,
  result: DelegatedKahoot,
) {
  const { status, childSessionId } = result;
  const text = result.text.replaceAll(childSessionId, '[…]');
  const kahoot = {
    parentRunId: parentId,
    status,
    kahootId: result.kahootId?.includes(childSessionId) ? undefined : result.kahootId,
    title: result.title?.replaceAll(childSessionId, '[…]'),
    editorUrl: result.editorUrl?.includes(childSessionId) ? undefined : result.editorUrl,
  };
  const terminal: RunEvent =
    status === 'failed' ? { type: 'error', code: 'kahoot_failed' } : { type: 'done', elapsedMs: 0 };
  const events: RunEvent[] = [{ type: 'delta', text, kahoot }, terminal];

  // A UUIDv8 derived from the private pair is the unique run key. Public request IDs stay random.
  const resultRows = await db.execute(sql`
    with parent as (
      select school_id,owner_id,membership_id,role,class_id,prompt
      from agent_runs where id=${parentId} and agent_id='jaew' and role='teacher'
        and status='running' and attempt_id=${attempt} and lease_until>clock_timestamp()
      for update
    ), fingerprint as (
      select encode(sha256(convert_to(${JSON.stringify(['delegated_kahoot', parentId, result.childSessionId])},'UTF8')),'hex') as hash
    ), child as (
      insert into agent_runs(id,school_id,owner_id,membership_id,role,class_id,prompt,request_id,agent_id,status)
      select (substr(hash,1,12)||'8'||substr(hash,14,3)||'8'||substr(hash,18,15))::uuid,
        school_id,owner_id,membership_id,role,class_id,prompt,gen_random_uuid(),'jeng',
        ${status === 'failed' ? 'failed' : 'succeeded'}
      from parent cross join fingerprint
      on conflict(id) do nothing returning id
    ), replay as (
      insert into run_events(run_id,body)
      select id,body from child cross join jsonb_array_elements(${JSON.stringify(events)}::jsonb)
        with ordinality as event(body,seq) order by seq
    ) select exists(select from parent) as authorized`);
  if (!resultRows.rows[0]?.authorized) throw new ForbiddenError();
}
