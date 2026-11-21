import { z } from 'zod';
import { getApprovalClaim } from './fill_claim_form';
import { addApproval } from './approval-store';
import { ownerOf } from './identity';
import { nonBlank, validatedTool } from './validated';

export const submitForApproval = validatedTool(
  z.strictObject({ claimId: nonBlank, note: z.string().optional() }),
  {
    name: 'submit_for_approval',
    description:
      'ส่งเอกสารเบิกที่กรอกแล้วและไม่เกินงบเข้ากล่องอนุมัติของ ผอ. (กล่องในระบบ ไม่ส่งอีเมลออกนอกระบบ) ต้องมี claimId จาก fill_claim_form ของครูคนเดียวกัน',
    gate: 'allow',
    execute: ({ claimId, note }, context) => {
      const { id: ownerId, key } = ownerOf(context);
      const stored = getApprovalClaim(claimId, key);
      if (!stored.approvalId) {
        const { claim } = stored;
        stored.approvalId = addApproval(
          ownerId,
          {
            claimId: claim.claimId,
            label: claim.label,
            date: claim.date,
            budgetCode: claim.budgetCode,
            purpose: claim.purpose,
            rows: claim.rows.map((row) => ({ ...row })),
            total: claim.total,
            remainingAfter: claim.remainingAfter,
            overBudget: claim.overBudget,
          },
          note ?? '',
        ).id;
      }
      return { mode: 'mock', approvalId: stored.approvalId, from: ownerId, status: 'pending' };
    },
  },
);
