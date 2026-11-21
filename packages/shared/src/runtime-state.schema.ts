import { z } from 'zod';
import { memoryIssue } from './memory.schema';

export const runtimeStatePath = '/__state';
export const runtimeStateMaxBytes = 1024 * 1024;

const memoryItemSchema = z.strictObject({
  id: z.string(),
  text: z.string().refine((text) => !memoryIssue(text)),
  updatedAt: z.number(),
});

const claimSchema = z.strictObject({
  claimId: z.string(),
  label: z.string(),
  date: z.string(),
  budgetCode: z.string(),
  purpose: z.string(),
  rows: z.array(
    z.strictObject({
      name: z.string(),
      qty: z.number(),
      unitPrice: z.number(),
      amount: z.number(),
    }),
  ),
  total: z.number(),
  remainingAfter: z.number(),
  overBudget: z.boolean(),
});

const approvalSchema = z.strictObject({
  id: z.string(),
  ownerId: z.string(),
  submittedAt: z.number(),
  note: z.string(),
  claim: claimSchema,
  status: z.enum(['pending', 'approved', 'returned']),
  reason: z.string().optional(),
  decidedAt: z.number().optional(),
});

const notificationSchema = z.strictObject({
  id: z.string(),
  to: z.string(),
  text: z.string(),
  createdAt: z.number(),
});

const publishedBriefSchema = z.strictObject({
  id: z.string(),
  ownerId: z.string(),
  text: z.string(),
  createdAt: z.number(),
});

const inboxItemSchema = z.strictObject({
  id: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  createdAt: z.number(),
});

const activitySchema = z.strictObject({
  ownerId: z.string(),
  action: z.string(),
  at: z.number(),
});

export const runtimeStateSchema = z.strictObject({
  version: z.literal(1),
  memory: z.record(z.string(), z.array(memoryItemSchema)),
  approvals: z.array(approvalSchema),
  notifications: z.array(notificationSchema),
  briefs: z.array(publishedBriefSchema),
  // Added after the first snapshots were taken; older snapshots restore with an empty mailbox.
  inbox: z.array(inboxItemSchema).default([]),
  // Teacher work recorded when a creation tool succeeds; read by teacher_activity.
  activity: z.array(activitySchema).default([]),
});

export type RuntimeState = z.infer<typeof runtimeStateSchema>;
