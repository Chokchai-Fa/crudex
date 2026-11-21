import { z } from 'zod';
import { schoolRoleSchema } from './identity.schema';

const named = { id: z.uuid(), name: z.string().trim().min(1).max(160) };
export const adminDirectoryQuery = z.strictObject({ schoolId: z.uuid().optional() });
export const adminCommandSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('createSchool'), ...named }),
  z.strictObject({ action: z.literal('createClass'), ...named, schoolId: z.uuid() }),
  z.strictObject({ action: z.literal('createAccount'), ...named }),
  z.strictObject({
    action: z.literal('enroll'),
    schoolId: z.uuid(),
    accountId: z.uuid(),
    placement: z.discriminatedUnion('role', [
      z.strictObject({ role: z.literal('teacher'), classId: z.uuid() }),
      z.strictObject({ role: z.literal('student'), classId: z.uuid() }),
      z.strictObject({ role: z.literal('guardian'), studentMembershipId: z.uuid() }),
      z.strictObject({ role: z.literal('principal') }),
    ]),
  }),
  z.strictObject({ action: z.literal('invite'), schoolId: z.uuid(), membershipId: z.uuid() }),
  // Adds the 8 sample (ตัวอย่าง) students and 3 past ม.2/1 scores to an existing class with no assessments.
  z.strictObject({ action: z.literal('seedSampleClass'), schoolId: z.uuid(), classId: z.uuid() }),
]);
export type AdminCommand = z.infer<typeof adminCommandSchema>;
const option = z.object({ id: z.uuid(), name: z.string() });
export const adminDirectorySchema = z.object({
  schools: z.array(option),
  classes: z.array(option),
  accounts: z.array(option),
  members: z.array(option.extend({ role: schoolRoleSchema, accountId: z.uuid() })),
});
export type AdminDirectory = z.infer<typeof adminDirectorySchema>;
export const adminResultSchema = z.union([
  z.object({ id: z.uuid(), seeded: z.boolean() }),
  z.object({ id: z.uuid() }),
  z.object({ credential: z.string().regex(/^[0-9a-f]{64}$/), expiresAt: z.iso.datetime() }),
]);
