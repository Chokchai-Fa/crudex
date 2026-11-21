import type { SchoolActor } from '@repo/shared';
import { ConflictError, ForbiddenError } from '../lib/errors';
import * as repo from '../repositories/memory.repository';
import { authorizeRunTool, ownedRun } from './runs.service';
import type { Deps } from '../types/deps';

export async function listProposals(d: Deps, a: SchoolActor, id: string) {
  await ownedRun(d, a, id);
  return { proposals: await repo.proposals(d.db, a, id) };
}
export async function approveProposal(d: Deps, a: SchoolActor, id: string, proposalId: string) {
  await ownedRun(d, a, id);
  if (!(await repo.approve(d.db, a, id, proposalId)).length)
    throw new ConflictError('Proposal is unavailable');
  return { approved: true };
}
export async function proposeMemory(d: Deps, id: string, token: string, text: string) {
  const scope = await authorizeRunTool(d, id, token);
  if (!scope.attemptId || !['jaew', 'lekha_por'].includes(scope.agentId))
    throw new ForbiddenError();
  await repo.propose(d.db, scope, id, scope.attemptId, text);
  return { status: 'awaiting_owner_approval' };
}
export async function searchMemory(
  d: Deps,
  id: string,
  token: string,
  query: string,
  limit: number,
) {
  const scope = await authorizeRunTool(d, id, token);
  return { items: await repo.search(d.db, scope, query, limit) };
}

export async function approvedMemories(d: Deps, a: SchoolActor) {
  return { items: await repo.search(d.db, a, '', 100) };
}
export async function forget(d: Deps, a: SchoolActor, id: string) {
  await repo.removeApproved(d.db, a, id);
}
