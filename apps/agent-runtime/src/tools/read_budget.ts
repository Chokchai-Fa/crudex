import { budgetSheet } from '../data/sample';
import type { ToolDefinition } from './types';

export const readBudget: ToolDefinition = {
  name: 'read_budget',
  description: 'อ่านชีตงบตัวอย่างของกลุ่มสาระ (ตัวจำลอง: ข้อมูลตัวอย่าง ไม่ใช่งบจริงของโรงเรียน) คืนรายการ งบ ใช้ไป และคงเหลือที่ระบบคำนวณ',
  input: { type: 'object', properties: { code: { type: 'string' } }, additionalProperties: false },
  gate: 'allow',
  execute: (input) => {
    const { code } = input as { code?: string };
    const lines = budgetSheet.lines.filter((l) => !code || l.code === code).map((l) => ({ ...l, remaining: l.budget - l.spent }));
    return { mode: 'mock', title: budgetSheet.title, unit: budgetSheet.unit, lines };
  },
};
