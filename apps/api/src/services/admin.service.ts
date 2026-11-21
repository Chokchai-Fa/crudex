import type { AdminCommand, SchoolActor } from '@repo/shared';
import type { Deps } from '../types/deps';
import { seedSampleClass } from '../repositories/sample-class.repository';
import * as repo from '../repositories/admin.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';
import { newCredential } from './identity.service';
export async function requirePlatformAdmin(d: Deps, a: SchoolActor) {
  if (!(await repo.isAdmin(d.db, a.ownerId)))
    throw new ForbiddenError('Platform administrator access required');
}
export function adminDirectory(d: Deps, schoolId?: string) {
  return repo.directory(d.db, schoolId);
}
export async function administer(d: Deps, c: AdminCommand) {
  if (c.action === 'invite') {
    const { token, digest } = await newCredential();
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    if (!(await repo.invite(d.db, c.schoolId, c.membershipId, digest, expiresAt)))
      throw new NotFoundError('Membership unavailable for invitation');
    return { credential: token, expiresAt };
  }
  if (c.action === 'seedSampleClass') {
    const seeded = await seedSampleClass(d.db, c.schoolId, c.classId);
    if (!seeded) throw new NotFoundError('Class unavailable in this school');
    return seeded;
  }
  if (c.action === 'enroll') {
    const member = await repo.enroll(d.db, c);
    if (!member) throw new ConflictError('Check school, account, active membership and placement');
    return member;
  }
  const row = await repo.createNamed(d.db, c);
  if (!row) throw new ConflictError('School unavailable or ID already used');
  return row;
}
