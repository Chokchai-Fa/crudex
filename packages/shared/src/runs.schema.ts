import { z } from 'zod';

export const agentIdSchema = z.enum([
  'jaew',
  'jum',
  'jeng',
  'porn',
  'nun',
  'rungchao',
  'lekha_por',
]);
export const recipientAgentSchema = z.enum(['jum', 'jeng', 'porn', 'nun']);
export type RecipientAgent = z.infer<typeof recipientAgentSchema>;
export type Handoff = {
  parentRunId: string;
  handoffId: string;
  agentId: RecipientAgent;
  status: 'started' | 'success' | 'failed' | 'returned';
  prompt: string;
  createdAt: string;
};
export const createRunSchema = z.strictObject({
  clientRequestId: z.uuid(),
  prompt: z.string().max(4000).trim().min(1),
  classId: z.uuid().optional(),
});
export const runStatusSchema = z.enum([
  'queued',
  'running',
  'succeeded',
  'failed',
  'interrupted',
  'cancelled',
]);
const kahootResultSchema = z.object({
  status: z.enum(['created', 'connect_required', 'failed']),
  kahootId: z.string().min(1).max(512).optional(),
  title: z.string().min(1).max(4000).optional(),
  editorUrl: z
    .url({ protocol: /^https$/ })
    .max(4096)
    .optional(),
});
// Private gateway frame. Only the result and reply text belong in public history.
export const delegatedKahootSchema = kahootResultSchema.extend({
  type: z.literal('delegated_kahoot'),
  agentId: z.literal('jeng'),
  childSessionId: z.string().min(1).max(512),
  text: z.string().min(1).max(64000),
});
export type DelegatedKahoot = z.infer<typeof delegatedKahootSchema>;

export const runEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), status: runStatusSchema }),
  z.object({
    type: z.literal('delta'),
    text: z.string(),
    messageId: z.string().min(1).optional(),
    interim: z.literal(true).optional(),
    kahoot: kahootResultSchema.extend({ parentRunId: z.uuid() }).optional(),
  }),
  z.object({ type: z.literal('approval'), kind: z.literal('memory'), proposalId: z.uuid() }),
  z.object({ type: z.literal('done'), elapsedMs: z.number() }),
  z.object({ type: z.literal('error'), code: z.string().max(128) }),
  z.object({
    type: z.literal('tool'),
    name: z.string(),
    id: z.string(),
    status: z.enum(['started', 'failed', 'success']),
    agentId: agentIdSchema.optional(),
    bridgeElapsedMs: z.number().optional(),
  }),
]);
export type RunEvent = z.infer<typeof runEventSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type CreateRun = z.infer<typeof createRunSchema>;
export type AgentId = z.infer<typeof agentIdSchema>;

export const runEventBatchMediaType = 'application/cloudevents-batch+json';
export const runEventPageSize = 128;
export const runEventBatchSchema = z
  .array(
    z.object({
      specversion: z.literal('1.0'),
      id: z.string().regex(/^[1-9]\d*$/),
      source: z.string(),
      type: z.string(),
      data: runEventSchema,
    }),
  )
  .max(runEventPageSize);
