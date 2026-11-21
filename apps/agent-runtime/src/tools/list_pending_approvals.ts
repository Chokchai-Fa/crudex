import { approvals } from './approval-store';
import type { ToolDefinition } from './types';

export function pendingApprovals() {
  return approvals
    .filter((record) => record.status === 'pending')
    .map((record) => ({
      approvalId: record.id,
      claimId: record.claim.claimId,
      purpose: record.claim.purpose,
      total: record.claim.total,
      remainingAfter: record.claim.remainingAfter,
      overBudget: record.claim.overBudget,
      submittedAt: record.submittedAt,
    }));
}

export const pendingLabel = (count: number) => `เอกสารรออนุมัติ ${count} รายการ`;

export const listPendingApprovals: ToolDefinition = {
  name: 'list_pending_approvals',
  description:
    'รายการเอกสารเบิกที่รอ ผอ. อนุมัติ (กล่องเดียวกับที่ป้าพรส่งเข้ามา) คืนจำนวน ข้อความสรุปจำนวน (countLabel ให้ใช้ตรงตัว เช่น เอกสารรออนุมัติ 1 รายการ) และสรุปต่อเอกสาร',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => {
    const items = pendingApprovals();
    return { count: items.length, countLabel: pendingLabel(items.length), items };
  },
};
