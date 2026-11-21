export { schoolScopeSchema } from '../../../packages/shared/src/school-dispatch.schema';
export type { SchoolScope } from '../../../packages/shared/src/school-dispatch.schema';
import { signedTurn, type SchoolScope } from '../../../packages/shared/src/school-dispatch.schema';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function validSchoolTurn(
  scope: SchoolScope,
  text: string,
  signature: unknown,
  owner: string,
  secret: string,
) {
  if (
    owner !== scope.schoolId + '/' + scope.ownerId ||
    scope.expiresAt <= Date.now() ||
    scope.expiresAt > Date.now() + 13 * 60_000 ||
    typeof signature !== 'string' ||
    !/^[0-9a-f]{64}$/.test(signature)
  )
    return false;
  return timingSafeEqual(
    createHmac('sha256', secret).update(signedTurn(scope, text)).digest(),
    Buffer.from(signature, 'hex'),
  );
}

export async function schoolTool(
  scope: SchoolScope,
  name: string,
  payload: unknown,
  signal: AbortSignal,
) {
  if (scope.expiresAt <= Date.now()) throw new Error('school_attempt_expired');
  const url = new URL('/api/internal/runs/' + scope.runId + '/tools/' + name, scope.callbackOrigin);
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + scope.credential, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
    redirect: 'error',
  });
  if (!response.ok) throw new Error('school_tool_unavailable');
  return response.json();
}
