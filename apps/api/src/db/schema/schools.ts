import {
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const schoolRole = pgEnum('school_role', ['teacher', 'principal', 'student', 'guardian']);
export const schools = pgTable('schools', {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull(),
});
export const schoolAccounts = pgTable('school_accounts', {
  id: uuid().primaryKey().defaultRandom(),
  displayName: text('display_name').notNull(),
});
export const schoolMemberships = pgTable(
  'school_memberships',
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => schoolAccounts.id),
    role: schoolRole().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [unique().on(t.schoolId, t.id), unique().on(t.schoolId, t.ownerId, t.role)],
);
export const schoolClasses = pgTable(
  'school_classes',
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id),
    name: text().notNull(),
  },
  (t) => [unique().on(t.schoolId, t.id)],
);

// Both teacher assignments and student enrollments refer to a role-bearing membership.
export const classAssignments = pgTable(
  'class_assignments',
  {
    schoolId: uuid('school_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    classId: uuid('class_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.membershipId, t.classId] }),
    foreignKey({
      columns: [t.schoolId, t.membershipId],
      foreignColumns: [schoolMemberships.schoolId, schoolMemberships.id],
    }),
    foreignKey({
      columns: [t.schoolId, t.classId],
      foreignColumns: [schoolClasses.schoolId, schoolClasses.id],
    }),
  ],
);
export const guardianStudents = pgTable(
  'guardian_students',
  {
    schoolId: uuid('school_id').notNull(),
    guardianMembershipId: uuid('guardian_membership_id').notNull(),
    studentMembershipId: uuid('student_membership_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.guardianMembershipId, t.studentMembershipId] }),
    foreignKey({
      columns: [t.schoolId, t.guardianMembershipId],
      foreignColumns: [schoolMemberships.schoolId, schoolMemberships.id],
    }),
    foreignKey({
      columns: [t.schoolId, t.studentMembershipId],
      foreignColumns: [schoolMemberships.schoolId, schoolMemberships.id],
    }),
  ],
);
export const schoolInvitations = pgTable('school_invitations', {
  digest: text().primaryKey(),
  membershipId: uuid('membership_id')
    .notNull()
    .references(() => schoolMemberships.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
export const schoolSessions = pgTable('school_sessions', {
  digest: text().primaryKey(),
  membershipId: uuid('membership_id')
    .notNull()
    .references(() => schoolMemberships.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});
