import { z } from 'zod';

const lineSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  quantity: z.int().min(1).max(10_000),
  unitPriceSatang: z.int().min(1).max(100_000_000),
});
export const budgetClaimSchema = z.strictObject({
  clientRequestId: z.uuid(),
  date: z.iso.date(),
  budgetCode: z.string().trim().min(1).max(80),
  purpose: z.string().trim().min(1).max(1000),
  items: z.array(lineSchema).min(1).max(50),
});
export const claimDecisionSchema = z.discriminatedUnion('decision', [
  z.strictObject({
    decision: z.literal('approve'),
    reason: z.string().trim().max(1000).optional(),
  }),
  z.strictObject({ decision: z.literal('return'), reason: z.string().trim().min(1).max(1000) }),
]);
export const approvalIdSchema = z.strictObject({ id: z.uuid() });
export const getApprovalToolSchema = z.strictObject({ approvalId: z.uuid() });
export type BudgetClaim = z.infer<typeof budgetClaimSchema>;
export type ClaimDecision = z.infer<typeof claimDecisionSchema>;
