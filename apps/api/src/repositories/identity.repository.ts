import type { SchoolRole } from '@repo/shared';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  classAssignments,
  guardianStudents,
  schoolAccounts,
  schoolClasses,
  schoolMemberships as memberships,
  schools,
  schoolSessions as sessions,
} from '../db/schema/schools';

const active = or(isNull(memberships.expiresAt), gt(memberships.expiresAt, sql`now()`));

export function listMemberships(db: Db, ownerId: string) {
  return db
    .select({
      id: memberships.id,
      schoolId: schools.id,
      schoolName: schools.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(schools, eq(schools.id, memberships.schoolId))
    .where(and(eq(memberships.ownerId, ownerId), active))
    .orderBy(schools.name, memberships.role);
}

export interface ActorScope {
  ownerId: string;
  schoolId: string;
  membershipId?: string;
  role?: SchoolRole;
}

export async function findMembership(db: Db, scope: ActorScope) {
  const [row] = await db
    .select({
      ownerId: memberships.ownerId,
      schoolId: memberships.schoolId,
      membershipId: memberships.id,
      role: memberships.role,
      displayName: schoolAccounts.displayName,
    })
    .from(memberships)
    .innerJoin(schoolAccounts, eq(schoolAccounts.id, memberships.ownerId))
    .where(
      and(
        eq(memberships.ownerId, scope.ownerId),
        eq(memberships.schoolId, scope.schoolId),
        scope.membershipId ? eq(memberships.id, scope.membershipId) : undefined,
        scope.role ? eq(memberships.role, scope.role) : undefined,
        active,
      ),
    )
    .limit(1);
  return row;
}

const classView = { id: schoolClasses.id, name: schoolClasses.name };
export function listSchoolClasses(db: Db, schoolId: string) {
  return db
    .select(classView)
    .from(schoolClasses)
    .where(eq(schoolClasses.schoolId, schoolId))
    .orderBy(schoolClasses.name);
}
export function listAssignedClasses(db: Db, membershipId: string) {
  return db
    .select(classView)
    .from(classAssignments)
    .innerJoin(schoolClasses, eq(schoolClasses.id, classAssignments.classId))
    .where(eq(classAssignments.membershipId, membershipId))
    .orderBy(schoolClasses.name);
}
export function listChildren(db: Db, guardianId: string) {
  return db
    .select({ id: schoolAccounts.id, displayName: schoolAccounts.displayName })
    .from(guardianStudents)
    .innerJoin(memberships, eq(memberships.id, guardianStudents.studentMembershipId))
    .innerJoin(schoolAccounts, eq(schoolAccounts.id, memberships.ownerId))
    .where(
      and(
        eq(guardianStudents.guardianMembershipId, guardianId),
        eq(memberships.role, 'student'),
        active,
      ),
    )
    .orderBy(schoolAccounts.displayName);
}
export async function findSession(db: Db, digest: string) {
  const [row] = await db
    .select({
      ownerId: memberships.ownerId,
      schoolId: memberships.schoolId,
      membershipId: memberships.id,
    })
    .from(sessions)
    .innerJoin(memberships, eq(memberships.id, sessions.membershipId))
    .where(and(eq(sessions.digest, digest), gt(sessions.expiresAt, sql`now()`), active))
    .limit(1);
  return row;
}
export async function exchangeInvitation(
  db: Db,
  invitation: string,
  session: string,
  expiresAt: Date,
) {
  const result = await db.execute(sql`
    WITH consumed AS (
      DELETE FROM school_invitations i USING school_memberships m
      WHERE i.digest = ${invitation} AND i.expires_at > now() AND m.id = i.membership_id
        AND (m.expires_at IS NULL OR m.expires_at > now())
      RETURNING i.membership_id
    )
    INSERT INTO school_sessions (digest, membership_id, expires_at)
    SELECT ${session}, membership_id, ${expiresAt.toISOString()}::timestamptz FROM consumed
    RETURNING membership_id
  `);
  return result.rows.length === 1;
}
export function insertSession(db: Db, digest: string, membershipId: string, expiresAt: Date) {
  return db.insert(sessions).values({ digest, membershipId, expiresAt });
}
export function deleteSession(db: Db, digest: string) {
  return db.delete(sessions).where(eq(sessions.digest, digest));
}
export async function selectMembership(db: Db, digest: string, targetId: string) {
  const result = await db.execute(sql`
    UPDATE school_sessions s SET membership_id = target.id
    FROM school_memberships current_m, school_memberships target
    WHERE s.digest = ${digest} AND s.expires_at > now() AND s.membership_id = current_m.id
      AND (current_m.expires_at IS NULL OR current_m.expires_at > now())
      AND target.owner_id = current_m.owner_id AND target.id = ${targetId}
      AND (target.expires_at IS NULL OR target.expires_at > now())
    RETURNING s.membership_id
  `);
  return result.rows.length === 1;
}
