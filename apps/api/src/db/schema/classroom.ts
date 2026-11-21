import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { AssessmentContent } from '@repo/shared';
import { schoolClasses, schoolMemberships, schools } from './schools';

export const assessments = pgTable(
  'assessments',
  {
    id: uuid().primaryKey().defaultRandom(),
    playToken: uuid('play_token').notNull().unique().defaultRandom(),
    schoolId: uuid('school_id')
      .notNull()
      .references(() => schools.id),
    classId: uuid('class_id').notNull(),
    runId: uuid('run_id').notNull(),
    invocationId: text('invocation_id').notNull(),
    content: jsonb().$type<AssessmentContent>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.runId, t.invocationId),
    index().on(t.schoolId, t.classId),
    foreignKey({
      columns: [t.schoolId, t.classId],
      foreignColumns: [schoolClasses.schoolId, schoolClasses.id],
    }),
  ],
);
export const submissions = pgTable(
  'quiz_submissions',
  {
    id: uuid().primaryKey().defaultRandom(),
    assessmentId: uuid('assessment_id')
      .notNull()
      .references(() => assessments.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => schoolMemberships.id),
    answers: jsonb().$type<Record<string, string>>().notNull(),
    score: integer().notNull(),
    maxScore: integer('max_score').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.assessmentId, t.studentId)],
);
export const routines = pgTable(
  'school_routines',
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull(),
    classId: uuid('class_id').notNull(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => schoolMemberships.id),
    hour: integer().notNull(),
    minute: integer().notNull(),
    enabled: boolean().notNull().default(true),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    unique().on(t.teacherId, t.classId, t.hour, t.minute),
    index().on(t.enabled, t.nextRunAt),
    foreignKey({
      columns: [t.schoolId, t.classId],
      foreignColumns: [schoolClasses.schoolId, schoolClasses.id],
    }),
  ],
);
export const reports = pgTable(
  'guardian_reports',
  {
    id: uuid().primaryKey().defaultRandom(),
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routines.id),
    occurrence: timestamp({ withTimezone: true }).notNull(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => schoolMemberships.id),
    guardianId: uuid('guardian_id')
      .notNull()
      .references(() => schoolMemberships.id),
    studentName: text('student_name').notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    status: text().notNull().default('draft'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.routineId, t.occurrence, t.studentId, t.guardianId)],
);
