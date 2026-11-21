import { approvalBox } from './inbox';
import { identityOf } from './identity';
import type { ToolDefinition } from './types';

export const submitForApproval: ToolDefinition = {
  name: 'submit_for_approval',
  description: 'ส่งเอกสารเบิกที่กรอกแล้วเข้ากล่องอนุมัติของ ผอ. (กล่องในระบบ ไม่ส่งอีเมลออกนอกระบบ) ต้องมี claimId จาก fill_claim_form',
  input: { type: 'object', properties: { claimId: { type: 'string' }, note: { type: 'string' } }, required: ['claimId'], additionalProperties: false },
  gate: 'allow',
  execute: (input, context) => {
    const { claimId, note } = input as { claimId: string; note?: string };
    const id = 'approval-' + crypto.randomUUID().slice(0, 8);
    approvalBox.push({ id, to: 'principal', subject: `ขออนุมัติเบิก ${claimId}`, body: note ?? '', createdAt: Date.now() });
    return { mode: 'mock', approvalId: id, from: identityOf(context).ownerId, status: 'pending' };
  },
};
