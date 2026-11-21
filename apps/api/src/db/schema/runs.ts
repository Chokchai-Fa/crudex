import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  integer,
  index,
  serial,
  jsonb,
  date,
} from 'drizzle-orm/pg-core';
import type { AgentId, RunEvent, RunStatus } from '@repo/shared';

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid().primaryKey(),
    schoolId: uuid('school_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    role: text().$type<'teacher' | 'principal'>().notNull(),
    agentId: text('agent_id').$type<AgentId>().notNull(),
    classId: uuid('class_id'),
    requestId: uuid('request_id').notNull(),
    prompt: text().notNull(),
    status: text().$type<RunStatus>().notNull().default('queued'),
    attemptId: uuid('attempt_id'),
    credentialHash: text('credential_hash'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('run_request_key').on(t.schoolId, t.ownerId, t.requestId),
    index('run_history_idx').on(t.schoolId, t.ownerId, t.agentId, t.createdAt),
  ],
);
export const runEvents = pgTable(
  'run_events',
  {
    id: serial().primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id),
    body: jsonb().$type<RunEvent>().notNull(),
  },
  (t) => [index('run_replay_idx').on(t.runId, t.id)],
);
export const runOutbox = pgTable('run_outbox', {
  runId: uuid('run_id')
    .primaryKey()
    .references(() => agentRuns.id),
});
export const runQuota = pgTable('run_quota', {
  day: date().primaryKey(),
  used: integer().notNull(),
});

export const runMemory = pgTable(
  'run_memory',
  {
    id: uuid().primaryKey().defaultRandom(),
    schoolId: uuid('school_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id),
    text: text().notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('memory_proposal_key').on(t.runId, t.text),
    index('memory_owner_idx').on(t.schoolId, t.ownerId),
  ],
);

export const ownerRunQuota = pgTable(
  'owner_run_quota',
  {
    day: date().notNull(),
    ownerId: uuid('owner_id').notNull(),
    used: integer().notNull(),
  },
  (t) => [uniqueIndex('owner_run_quota_day').on(t.day, t.ownerId)],
);
