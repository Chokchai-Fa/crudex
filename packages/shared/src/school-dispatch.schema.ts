import { z } from 'zod';
import { schoolRoleSchema } from './identity.schema';
import { agentIdSchema } from './runs.schema';

export const schoolKahootAccountSchema = z.strictObject({
  schoolId: z.uuid(),
  ownerId: z.uuid(),
  role: schoolRoleSchema,
});
export type SchoolKahootAccount = z.infer<typeof schoolKahootAccountSchema>;

export const schoolKahootCallbackPath = '/api/integrations/kahoot/callback';

export type KahootStatus =
  { connected: false } | { connected: true; connectedAt: number; expiresAt: number };

export interface SchoolKahootRpc {
  kahootConnect(account: SchoolKahootAccount, redirectUri: string): Promise<{ url: string }>;
  kahootCallback(state: string, code: string | null): Promise<{ ok: boolean }>;
  kahootStatus(account: SchoolKahootAccount): Promise<KahootStatus>;
  kahootDisconnect(account: SchoolKahootAccount): Promise<KahootStatus>;
}

export const schoolScopeSchema = z.strictObject({
  schoolId: z.uuid(),
  ownerId: z.uuid(),
  classId: z.uuid().nullable(),
  role: z.enum(['teacher', 'principal']),
  freshSession: z.boolean(),
  kahootConnected: z.boolean().optional(),
  agentId: agentIdSchema,
  runId: z.uuid(),
  attemptId: z.uuid(),
  expiresAt: z.number().int(),
  callbackOrigin: z.url(),
  credential: z.string().regex(/^[0-9a-f-]{72}$/),
});
export type SchoolScope = z.infer<typeof schoolScopeSchema>;
export const dispatchSchema = z.strictObject({
  text: z.string().min(1).max(4000),
  agentId: agentIdSchema,
  scope: schoolScopeSchema,
});
// An ordered tuple makes the signature independent of JSON property order.
export function signedTurn(s: SchoolScope, text: string) {
  return JSON.stringify([
    s.schoolId,
    s.ownerId,
    s.classId,
    s.role,
    s.agentId,
    s.freshSession,
    s.runId,
    s.attemptId,
    s.expiresAt,
    s.callbackOrigin,
    s.credential,
    text,
    ...(s.kahootConnected === undefined ? [] : [s.kahootConnected]),
  ]);
}
