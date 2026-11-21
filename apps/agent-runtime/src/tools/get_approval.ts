import { anomaliesOf, approvals } from './approval-store';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

export const getApproval: ToolDefinition = {
  name: 'get_approval',
  description:
    'อ่านเอกสารเบิกหนึ่งฉบับที่ส่งเข้ากล่องอนุมัติ พร้อมสรุปจากป้าพร และจุดผิดปกติที่โค้ดตรวจพบ (เกินงบ วันที่ผิด เอกสารไม่ครบ) ยอดทุกตัวคำนวณโดยระบบ',
  input: {
    type: 'object',
    properties: { approvalId: { type: 'string' } },
    required: ['approvalId'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => {
    const { approvalId } = input as { approvalId: string };
    const record = approvals.find((r) => r.id === approvalId);
    if (!record) throw new ToolError('not_found', `ไม่พบเอกสาร ${approvalId}`);
    return { ...record, anomalies: anomaliesOf(record) };
  },
};
