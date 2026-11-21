import { teacherActivityLog } from '../data/school';
import { approvals } from './approval-store';
import type { ToolDefinition } from './types';

const submittedAction = 'ส่งเอกสารเบิกเข้ากล่องอนุมัติ';

export const teacherActivity: ToolDefinition = {
  name: 'teacher_activity',
  description:
    'งานที่ครูทำในระบบ เช่น ใบงานหรือ Form ที่สร้าง เอกสารที่ส่งเข้ากล่องอนุมัติ (ตัวจำลอง: ข้อมูลตัวอย่าง) คืนจำนวนต่อครูและต่อประเภทงาน ไม่มีข้อมูลนักเรียน',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => {
    const byAction = new Map<string, number>();
    // Claims come from the real approval box, so this count matches list_pending_approvals.
    const submitted = approvals.length
      ? [
          {
            teacher: 'ครูในระบบ',
            date: 'ทั้งหมด',
            action: submittedAction,
            count: approvals.length,
          },
        ]
      : [];
    const entries = [...teacherActivityLog, ...submitted];
    for (const entry of entries) {
      byAction.set(entry.action, (byAction.get(entry.action) ?? 0) + entry.count);
    }
    return {
      mode: 'mock',
      label: 'ตัวอย่าง',
      entries,
      pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
      totals: [...byAction].map(([action, count]) => ({ action, count })),
    };
  },
};
