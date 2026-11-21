import { z } from 'zod';

export const schoolRoleSchema = z.enum(['teacher', 'principal', 'student', 'guardian']);
export type SchoolRole = z.infer<typeof schoolRoleSchema>;

export const membershipSchema = z.object({
  id: z.uuid(),
  schoolId: z.uuid(),
  schoolName: z.string(),
  role: schoolRoleSchema,
});

export const schoolActorSchema = z.object({
  ownerId: z.uuid(),
  schoolId: z.uuid(),
  membershipId: z.uuid(),
  role: schoolRoleSchema,
  displayName: z.string(),
  classes: z.array(z.object({ id: z.uuid(), name: z.string() })),
  children: z.array(z.object({ id: z.uuid(), displayName: z.string() })),
});
export type SchoolActor = z.infer<typeof schoolActorSchema>;
export const meSchema = z.object({
  actor: schoolActorSchema,
  memberships: z.array(membershipSchema),
});
export type SchoolMe = z.infer<typeof meSchema>;
export const credentialSchema = z.strictObject({ credential: z.string().regex(/^[a-f0-9]{64}$/) });
export const selectMembershipSchema = z.strictObject({ membershipId: z.uuid() });
export const localSignInSchema = z.strictObject({
  school: z.enum(['lotus', 'river']),
  role: schoolRoleSchema,
  account: z.union([z.literal(1), z.literal(2)]).default(1),
});
export type LocalSignIn = z.infer<typeof localSignInSchema>;

export const guestSignInSchema = z.strictObject({ role: z.enum(['teacher', 'principal']) });
export type GuestSignIn = z.infer<typeof guestSignInSchema>;
