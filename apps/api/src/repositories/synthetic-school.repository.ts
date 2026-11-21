import type { LocalSignIn, SchoolRole } from '@repo/shared';
import type { Db } from '../db/client';
import {
  classAssignments,
  guardianStudents,
  schoolAccounts,
  schoolClasses,
  schoolMemberships,
  schools,
} from '../db/schema/schools';

const roles: SchoolRole[] = ['teacher', 'principal', 'student', 'guardian'];
const campuses = [
  { slug: 'lotus', name: 'โรงเรียนบัวหลวง' },
  { slug: 'river', name: 'โรงเรียนริมน้ำ' },
] as const;

function fixtureId(campus: number, kind: number, index: number) {
  return `ac00000${campus}-0000-4000-800${kind}-${String(index).padStart(12, '0')}`;
}

export function fixtureMembership(input: LocalSignIn) {
  const campus = campuses.findIndex((entry) => entry.slug === input.school) + 1;
  return fixtureId(campus, 2, roles.indexOf(input.role) * 2 + input.account);
}

// One transaction seeds both schools on first local sign-in, including two teachers with disjoint classrooms.
export async function seedLocalSchools(db: Db) {
  const schoolRows = campuses.map((campus, i) => ({
    id: fixtureId(i + 1, 0, 0),
    name: campus.name,
  }));
  const accounts: (typeof schoolAccounts.$inferInsert)[] = [];
  const memberships: (typeof schoolMemberships.$inferInsert)[] = [];
  const classes: (typeof schoolClasses.$inferInsert)[] = [];
  const assignments: (typeof classAssignments.$inferInsert)[] = [];
  const families: (typeof guardianStudents.$inferInsert)[] = [];
  for (const [i, campus] of campuses.entries()) {
    const campusNumber = i + 1;
    const schoolId = fixtureId(campusNumber, 0, 0);
    for (const account of [1, 2] as const) {
      const classId = fixtureId(campusNumber, 3, account);
      classes.push({ id: classId, schoolId, name: `ป.4/${account}` });
      for (const role of roles) {
        const id = fixtureMembership({ school: campus.slug, role, account });
        const ownerId = fixtureId(campusNumber, 1, roles.indexOf(role) * 2 + account);
        accounts.push({ id: ownerId, displayName: `${campus.slug} ${role} ${account}` });
        memberships.push({ id, ownerId, schoolId, role });
        if (role === 'teacher' || role === 'student') {
          assignments.push({ schoolId, membershipId: id, classId });
        }
      }
    }
    for (const [guardian, student] of [
      [1, 1],
      [2, 1],
      [2, 2],
    ] as const) {
      families.push({
        schoolId,
        guardianMembershipId: fixtureMembership({
          school: campus.slug,
          role: 'guardian',
          account: guardian,
        }),
        studentMembershipId: fixtureMembership({
          school: campus.slug,
          role: 'student',
          account: student,
        }),
      });
    }
  }
  await db.batch([
    db.insert(schools).values(schoolRows).onConflictDoNothing(),
    db.insert(schoolAccounts).values(accounts).onConflictDoNothing(),
    db.insert(schoolMemberships).values(memberships).onConflictDoNothing(),
    db.insert(schoolClasses).values(classes).onConflictDoNothing(),
    db.insert(classAssignments).values(assignments).onConflictDoNothing(),
    db.insert(guardianStudents).values(families).onConflictDoNothing(),
  ]);
}
