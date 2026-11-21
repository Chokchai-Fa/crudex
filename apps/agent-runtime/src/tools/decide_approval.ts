import { approvals, notifications } from './approval-store';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

export const decideApproval: ToolDefinition = {
  name: 'decide_approval',
  description:
    'บันทึกการตัดสินเอกสารเบิก: approve (อนุมัติ) หรือ return (ส่งกลับ ต้องมีเหตุผล) ผอ. ต้องกดยืนยันเองทุกครั้ง agent ห้ามตัดสินแทน ผลถูกแจ้งกลับไปที่ป้าพรและครูผ่านกล่องแจ้งเตือนในระบบ',
  input: {
    type: 'object',
    properties: {
      approvalId: { type: 'string' },
      decision: { type: 'string', enum: ['approve', 'return'] },
      reason: { type: 'string' },
    },
    required: ['approvalId', 'decision'],
    additionalProperties: false,
  },
  gate: 'ask',
  execute: (input) => {
    const { approvalId, decision, reason } = input as {
      approvalId: string;
      decision: 'approve' | 'return';
      reason?: string;
    };
    const record = approvals.find((r) => r.id === approvalId);
    if (!record) throw new ToolError('not_found', `ไม่พบเอกสาร ${approvalId}`);
    if (record.status !== 'pending')
      throw new ToolError('already_decided', 'เอกสารนี้ตัดสินไปแล้ว');
    if (decision === 'return' && !reason?.trim())
      throw new ToolError('reason_required', 'การส่งกลับต้องมีเหตุผล');
    record.status = decision === 'approve' ? 'approved' : 'returned';
    record.reason = reason?.trim();
    record.decidedAt = Date.now();
    const text =
      decision === 'approve'
        ? `ผอ. อนุมัติเอกสาร ${record.claim.claimId}`
        : `ผอ. ส่งกลับเอกสาร ${record.claim.claimId}: ${record.reason}`;
    for (const to of ['porn', record.ownerId]) {
      notifications.push({
        id: 'note-' + crypto.randomUUID().slice(0, 8),
        to,
        text,
        createdAt: Date.now(),
      });
    }
    return { mode: 'mock', approvalId, status: record.status, notified: ['porn', record.ownerId] };
  },
};
