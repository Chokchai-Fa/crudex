import { teacherActivityLog } from '../data/school';
import type { ToolDefinition } from './types';

export const teacherActivity: ToolDefinition = {
  name: 'teacher_activity',
  description:
    'งานที่ครูทำในระบบ เช่น ใบงานหรือ Form ที่สร้าง เอกสารที่ส่งเข้ากล่องอนุมัติ (ตัวจำลอง: ข้อมูลตัวอย่าง) คืนจำนวนต่อครูและต่อประเภทงาน ไม่มีข้อมูลนักเรียน',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => {
    const byAction = new Map<string, number>();
    for (const entry of teacherActivityLog) {
      byAction.set(entry.action, (byAction.get(entry.action) ?? 0) + entry.count);
    }
    return {
      mode: 'mock',
      label: 'ตัวอย่าง',
      entries: teacherActivityLog,
      totals: [...byAction].map(([action, count]) => ({ action, count })),
    };
  },
};
