import { and, eq, sql, desc, isNotNull, isNull } from 'drizzle-orm';
import { runMemory as memory } from '../db/schema/runs';
import type { Db } from '../db/client';

interface Scope {
  schoolId: string;
  ownerId: string;
}
const owner = (s: Scope) => and(eq(memory.schoolId, s.schoolId), eq(memory.ownerId, s.ownerId));
export async function propose(db: Db, s: Scope, runId: string, attemptId: string, text: string) {
  // Lock the run before assigning the event ID, serializing with stream and terminal events.
  await db.execute(sql`with active as (
    select id,school_id,owner_id from agent_runs where id=${runId} and school_id=${s.schoolId} and owner_id=${s.ownerId}
      and attempt_id=${attemptId} and status='running' and lease_until>now() for update
  ), proposed as (
    insert into run_memory(school_id,owner_id,run_id,text) select school_id,owner_id,id,${text} from active
    on conflict do nothing returning id,run_id
  ) insert into run_events(run_id,body) select run_id,jsonb_build_object('type','approval','kind','memory','proposalId',id) from proposed`);
}
export function proposals(db: Db, s: Scope, runId: string) {
  return db
    .select({
      id: memory.id,
      text: memory.text,
      approved: sql<boolean>`${memory.approvedAt} is not null`,
    })
    .from(memory)
    .where(and(owner(s), eq(memory.runId, runId)));
}
export function approve(db: Db, s: Scope, runId: string, id: string) {
  return db
    .update(memory)
    .set({ approvedAt: new Date() })
    .where(and(owner(s), eq(memory.runId, runId), eq(memory.id, id), isNull(memory.approvedAt)))
    .returning({ id: memory.id });
}
export function search(db: Db, s: Scope, query: string, limit: number) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return db
    .select({ id: memory.id, text: memory.text, updatedAt: memory.approvedAt })
    .from(memory)
    .where(
      and(
        owner(s),
        isNotNull(memory.approvedAt),
        ...terms.map((term) => sql`position(${term} in lower(${memory.text})) > 0`),
      ),
    )
    .orderBy(desc(memory.approvedAt))
    .limit(limit);
}

export function removeApproved(db: Db, s: Scope, id: string) {
  return db
    .delete(memory)
    .where(and(owner(s), eq(memory.id, id), isNotNull(memory.approvedAt)))
    .returning({ id: memory.id });
}
