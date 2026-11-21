import { and, eq, sql } from 'drizzle-orm';
import type { AdminCommand } from '@repo/shared';
import type { Db } from '../db/client';
import {
  schools,
  schoolClasses,
  schoolAccounts,
  schoolMemberships,
  platformAdmins,
} from '../db/schema';

export async function isAdmin(db: Db, id: string) {
  const rows = await db
    .select({ id: platformAdmins.accountId })
    .from(platformAdmins)
    .where(eq(platformAdmins.accountId, id));
  return rows.length > 0;
}
export async function directory(db: Db, schoolId?: string) {
  const [schoolRows, accounts, classes, members] = await Promise.all([
    db
      .select({ id: schools.id, name: schools.name })
      .from(schools)
      .orderBy(schools.name, schools.id),
    db
      .select({ id: schoolAccounts.id, name: schoolAccounts.displayName })
      .from(schoolAccounts)
      .orderBy(schoolAccounts.displayName, schoolAccounts.id),
    schoolId
      ? db
          .select({ id: schoolClasses.id, name: schoolClasses.name })
          .from(schoolClasses)
          .where(eq(schoolClasses.schoolId, schoolId))
          .orderBy(schoolClasses.name, schoolClasses.id)
      : [],
    schoolId
      ? db
          .select({
            id: schoolMemberships.id,
            accountId: schoolAccounts.id,
            role: schoolMemberships.role,
            name: schoolAccounts.displayName,
          })
          .from(schoolMemberships)
          .innerJoin(schoolAccounts, eq(schoolAccounts.id, schoolMemberships.ownerId))
          .where(
            and(
              eq(schoolMemberships.schoolId, schoolId),
              sql`(${schoolMemberships.expiresAt} is null or ${schoolMemberships.expiresAt}>now())`,
            ),
          )
          .orderBy(schoolAccounts.displayName, schoolMemberships.id)
      : [],
  ]);
  return { schools: schoolRows, accounts, classes, members };
}

type Create = Extract<AdminCommand, { action: 'createSchool' | 'createClass' | 'createAccount' }>;
export async function createNamed(db: Db, c: Create) {
  // Stable client IDs allow a lost response to be retried without duplicating a person or class.
  const table =
    c.action === 'createSchool'
      ? schools
      : c.action === 'createClass'
        ? schoolClasses
        : schoolAccounts;
  const name =
    c.action === 'createAccount' ? sql.identifier('display_name') : sql.identifier('name');
  const result =
    c.action === 'createClass'
      ? await db.execute<{ id: string }>(sql`
    insert into school_classes (id,name,school_id)
    select ${c.id},${c.name},id from schools where id=${c.schoolId}
    on conflict (id) do update set name=excluded.name
    where school_classes.name=excluded.name and school_classes.school_id=excluded.school_id returning id
  `)
      : await db.execute<{ id: string }>(sql`
    insert into ${table} (id,${name}) values (${c.id},${c.name})
    on conflict (id) do update set ${name}=excluded.${name} where ${table}.${name}=excluded.${name} returning id
  `);
  return result.rows[0];
}

export async function enroll(db: Db, c: Extract<AdminCommand, { action: 'enroll' }>) {
  const p = c.placement;
  const eligible =
    'classId' in p
      ? sql`exists(select from school_classes where id=${p.classId} and school_id=${c.schoolId})`
      : p.role === 'guardian'
        ? sql`exists(select from school_memberships where id=${p.studentMembershipId} and school_id=${c.schoolId} and role='student' and owner_id<>${c.accountId} and (expires_at is null or expires_at>now()))`
        : sql`true`;
  const assignment =
    'classId' in p
      ? sql`, assigned as (insert into class_assignments(school_id,membership_id,class_id) select school_id,id,${p.classId} from member on conflict do nothing)`
      : p.role === 'guardian'
        ? sql`, linked as (insert into guardian_students(school_id,guardian_membership_id,student_membership_id) select school_id,id,${p.studentMembershipId} from member on conflict do nothing)`
        : sql``;
  const result = await db.execute<{ id: string }>(sql`
    with member as (insert into school_memberships (school_id,owner_id,role)
      select s.id,a.id,${p.role}::school_role from schools s,school_accounts a
      where s.id=${c.schoolId} and a.id=${c.accountId} and ${eligible}
      on conflict (school_id,owner_id,role) do update set role=excluded.role
      where school_memberships.expires_at is null or school_memberships.expires_at>now()
      returning id,school_id) ${assignment}
    select id from member`);
  return result.rows[0];
}
export async function invite(
  db: Db,
  schoolId: string,
  membershipId: string,
  digest: string,
  expiresAt: string,
) {
  const result =
    await db.execute(sql`insert into school_invitations(digest,membership_id,expires_at)
    select ${digest},m.id,${expiresAt}::timestamptz from school_memberships m
    where m.id=${membershipId} and m.school_id=${schoolId} and (m.expires_at is null or m.expires_at>now())
    and not exists(select from platform_admins a where a.account_id=m.owner_id) returning membership_id`);
  return result.rows.length === 1;
}
