import { principalAgents, teacherAgents } from './agents';
import { teacherOwnerOf } from './data/accounts';
import { sampleClassId } from './data/sample';
import { principalOwner } from './data/school';

const loginIdPattern = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/;

export function validLoginId(id: unknown, agentId: string): id is string {
  return (
    typeof id === 'string' &&
    (loginIdPattern.test(id) || (id === 'scheduled' && agentId === 'rungchao'))
  );
}

interface Session {
  agent?: string;
  parentID?: string;
  metadata?: Record<string, unknown>;
}

export function isOwnedRoot(session: Session, agentId: string, loginId: string) {
  return (
    !session.parentID && session.agent === agentId && session.metadata?.crudexLoginId === loginId
  );
}

/** Follow the actual OpenCode parent link. Child metadata and model inputs are never identity sources. */
export async function resolveToolOwner(
  getSession: (id: string) => Promise<Session>,
  sessionId: string,
  agentId: string,
) {
  const session = await getSession(sessionId);
  if (session.agent !== agentId) throw new Error('invalid_session_agent');
  const root = session.parentID ? await getSession(session.parentID) : session;
  if (root.parentID || !root.agent || !validLoginId(root.metadata?.crudexLoginId, root.agent))
    throw new Error('unbound_session');
  if (session.parentID) {
    const parent = teacherAgents.find(({ id }) => id === root.agent);
    if (!parent?.subagents.includes(agentId)) throw new Error('invalid_delegation');
  }
  const loginId = root.metadata?.crudexLoginId as string;
  if (teacherAgents.some(({ id }) => id === root.agent)) {
    if (loginId === 'scheduled') throw new Error('unbound_session');
    return { ownerId: teacherOwnerOf(loginId), classId: sampleClassId };
  }
  if (principalAgents.some(({ id }) => id === root.agent)) return { ownerId: principalOwner };
  throw new Error('unknown_demo_account');
}
