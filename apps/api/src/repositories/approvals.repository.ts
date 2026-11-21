import { and, desc, eq, sql } from 'drizzle-orm';
import type { BudgetClaim, SchoolActor } from '@repo/shared';
import type { Db } from '../db/client';
import { budgetClaims, claimNotifications } from '../db/schema/approvals';

export type ClaimScope = Pick<SchoolActor, 'schoolId' | 'role' | 'membershipId'>;
function visible(scope: ClaimScope) {
  return and(
    eq(budgetClaims.schoolId, scope.schoolId),
    scope.role === 'teacher' ? eq(budgetClaims.teacherId, scope.membershipId) : undefined,
  );
}
export async function submit(db: Db, scope: ClaimScope, claim: BudgetClaim) {
  const [inserted] = await db
    .insert(budgetClaims)
    .values({ ...claim, schoolId: scope.schoolId, teacherId: scope.membershipId })
    .onConflictDoNothing({ target: [budgetClaims.teacherId, budgetClaims.clientRequestId] })
    .returning();
  if (inserted) return inserted;
  const [existing] = await db
    .select()
    .from(budgetClaims)
    .where(and(visible(scope), eq(budgetClaims.clientRequestId, claim.clientRequestId)));
  return existing;
}
export async function get(db: Db, scope: ClaimScope, id: string) {
  const [claim] = await db
    .select()
    .from(budgetClaims)
    .where(and(visible(scope), eq(budgetClaims.id, id)));
  return claim;
}
export function list(db: Db, scope: ClaimScope, pendingOnly: boolean) {
  return db
    .select()
    .from(budgetClaims)
    .where(and(visible(scope), pendingOnly ? eq(budgetClaims.status, 'pending') : undefined))
    .orderBy(desc(budgetClaims.submittedAt), desc(budgetClaims.id))
    .limit(100);
}
export async function decide(
  db: Db,
  scope: ClaimScope,
  id: string,
  status: 'approved' | 'returned',
  reason: string | null,
) {
  // Neon HTTP runs a single statement atomically. Only the winning pending transition
  // feeds the notification insert, so concurrent calls cannot notify a teacher twice.
  await db.execute(sql`
    WITH decided AS (
      UPDATE ${budgetClaims} SET status = ${status}::claim_status, reason = ${reason},
        decided_by = ${scope.membershipId}::uuid, decided_at = now()
      WHERE school_id = ${scope.schoolId}::uuid AND id = ${id}::uuid AND status = 'pending'
      RETURNING id
    )
    INSERT INTO ${claimNotifications} (claim_id, channel)
    SELECT decided.id, recipient.channel FROM decided
      CROSS JOIN (VALUES ('teacher'::claim_channel), ('budget_assistant'::claim_channel)) AS recipient(channel)
  `);
  return get(db, scope, id);
}
export function notifications(db: Db, scope: ClaimScope, channel: 'teacher' | 'budget_assistant') {
  return db
    .select({
      id: claimNotifications.id,
      claimId: budgetClaims.id,
      status: budgetClaims.status,
      reason: budgetClaims.reason,
      createdAt: budgetClaims.decidedAt,
      purpose: budgetClaims.purpose,
    })
    .from(claimNotifications)
    .innerJoin(budgetClaims, eq(budgetClaims.id, claimNotifications.claimId))
    .where(and(visible(scope), eq(claimNotifications.channel, channel)))
    .orderBy(desc(budgetClaims.decidedAt))
    .limit(100);
}
