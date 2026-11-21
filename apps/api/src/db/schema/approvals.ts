import {
  date,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import type { BudgetClaim } from '@repo/shared';
import { schoolMemberships } from './schools';

export const claimStatus = pgEnum('claim_status', ['pending', 'approved', 'returned']);
export const claimChannel = pgEnum('claim_channel', ['teacher', 'budget_assistant']);
export const budgetClaims = pgTable(
  'budget_claims',
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull(),
    teacherId: uuid('teacher_id').notNull(),
    clientRequestId: uuid('client_request_id').notNull(),
    date: date().notNull(),
    budgetCode: text('budget_code').notNull(),
    purpose: text().notNull(),
    items: jsonb().$type<BudgetClaim['items']>().notNull(),
    status: claimStatus().default('pending').notNull(),
    decidedBy: uuid('decided_by'),
    reason: text(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.teacherId, t.clientRequestId),
    foreignKey({
      columns: [t.schoolId, t.teacherId],
      foreignColumns: [schoolMemberships.schoolId, schoolMemberships.id],
    }),
    foreignKey({
      columns: [t.schoolId, t.decidedBy],
      foreignColumns: [schoolMemberships.schoolId, schoolMemberships.id],
    }),
    index().on(t.schoolId, t.status, t.submittedAt),
    index().on(t.teacherId, t.submittedAt),
  ],
);
export const claimNotifications = pgTable(
  'claim_notifications',
  {
    id: uuid().primaryKey().defaultRandom(),
    claimId: uuid('claim_id')
      .notNull()
      .references(() => budgetClaims.id),
    channel: claimChannel().notNull(),
  },
  (t) => [unique().on(t.claimId, t.channel)],
);
