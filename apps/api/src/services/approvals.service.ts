import type { BudgetClaim, ClaimDecision, SchoolActor } from '@repo/shared';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';
import * as repo from '../repositories/approvals.repository';
import type { Deps } from '../types/deps';
import { authorizeRunTool } from './runs.service';

function requireStaff(actor: repo.ClaimScope) {
  if (actor.role !== 'teacher' && actor.role !== 'principal') throw new ForbiddenError();
}
function total(claim: Pick<BudgetClaim, 'items'>) {
  return claim.items.reduce((sum, line) => sum + line.quantity * line.unitPriceSatang, 0);
}
type ClaimRow = NonNullable<Awaited<ReturnType<typeof repo.get>>>;
function detail(row: ClaimRow) {
  const { clientRequestId: _, ...claim } = row;
  return { ...claim, totalSatang: total(row) };
}
export async function submitClaim(d: Deps, a: SchoolActor, input: BudgetClaim) {
  if (a.role !== 'teacher') throw new ForbiddenError();
  const row = await repo.submit(d.db, a, input);
  if (
    !row ||
    row.date !== input.date ||
    row.budgetCode !== input.budgetCode ||
    row.purpose !== input.purpose ||
    input.items.length !== row.items.length ||
    input.items.some((v, i) => {
      const line = row.items[i];
      return (
        !line ||
        v.name !== line.name ||
        v.quantity !== line.quantity ||
        v.unitPriceSatang !== line.unitPriceSatang
      );
    })
  )
    throw new ConflictError('Request ID already belongs to a different claim');
  return detail(row);
}
export async function listClaims(d: Deps, a: repo.ClaimScope) {
  requireStaff(a);
  return { claims: (await repo.list(d.db, a, false)).map(detail) };
}
export async function readClaim(d: Deps, a: repo.ClaimScope, id: string) {
  requireStaff(a);
  const row = await repo.get(d.db, a, id);
  if (!row) throw new NotFoundError();
  return detail(row);
}
export async function decideClaim(d: Deps, a: SchoolActor, id: string, input: ClaimDecision) {
  if (a.role !== 'principal') throw new ForbiddenError();
  const status = input.decision === 'return' ? 'returned' : 'approved';
  const reason = input.reason || null;
  const claim = await repo.decide(d.db, a, id, status, reason);
  if (!claim) throw new NotFoundError();
  if (claim.decidedBy !== a.membershipId || claim.status !== status || claim.reason !== reason)
    throw new ConflictError('Claim already decided');
  return detail(claim);
}
export async function listNotifications(
  d: Deps,
  a: SchoolActor,
  channel: 'teacher' | 'budget_assistant',
) {
  if (a.role !== 'teacher') throw new ForbiddenError();
  return { notifications: await repo.notifications(d.db, a, channel) };
}
async function principalRun(d: Deps, runId: string, token: string) {
  const run = await authorizeRunTool(d, runId, token);
  if (run.role !== 'principal' || !['lekha_por', 'rungchao'].includes(run.agentId))
    throw new ForbiddenError();
  return run;
}
export async function pendingTool(d: Deps, runId: string, token: string) {
  const rows = await repo.list(d.db, await principalRun(d, runId, token), true);
  const items = rows.map((row) => ({
    approvalId: row.id,
    purpose: row.purpose,
    totalSatang: total(row),
    submittedAt: row.submittedAt,
  }));
  return { count: items.length, items };
}
export async function detailTool(d: Deps, runId: string, token: string, approvalId: string) {
  return readClaim(d, await principalRun(d, runId, token), approvalId);
}
