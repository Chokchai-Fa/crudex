import type { GuestSignIn } from '@repo/shared';
import type { Db } from '../db/client';
import {
  classAssignments,
  schoolAccounts,
  schoolClasses,
  schoolMemberships,
  schoolSessions,
  schools,
} from '../db/schema/schools';

export async function createGuestSchool(
  db: Db,
  role: GuestSignIn['role'],
  digest: string,
  expiresAt: Date,
) {
  const schoolId = crypto.randomUUID();
  const classId = crypto.randomUUID();
  const guest = {
    ownerId: crypto.randomUUID(),
    id: crypto.randomUUID(),
    role,
    displayName: role === 'teacher' ? 'ครูทดลอง' : 'ผู้อำนวยการทดลอง',
  };
  const students = ['นักเรียนตัวอย่าง ก', 'นักเรียนตัวอย่าง ข'].map((displayName) => ({
    ownerId: crypto.randomUUID(),
    id: crypto.randomUUID(),
    role: 'student' as const,
    displayName,
  }));
  const people = [guest, ...students];
  // Neon executes the batch as one transaction, including the session that unlocks it.
  await db.batch([
    db.insert(schools).values({ id: schoolId, name: 'โรงเรียนทดลอง' }),
    db.insert(schoolClasses).values({ id: classId, schoolId, name: 'ป.4/1' }),
    db
      .insert(schoolAccounts)
      .values(people.map((p) => ({ id: p.ownerId, displayName: p.displayName }))),
    db
      .insert(schoolMemberships)
      .values(people.map(({ id, ownerId, role }) => ({ id, ownerId, role, schoolId, expiresAt }))),
    db
      .insert(classAssignments)
      .values(
        people
          .filter((p) => p.role !== 'principal')
          .map((p) => ({ schoolId, classId, membershipId: p.id })),
      ),
    db.insert(schoolSessions).values({ digest, membershipId: guest.id, expiresAt }),
  ]);
}
