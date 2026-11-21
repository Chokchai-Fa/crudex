import { z } from 'zod';
import { budgetSheet } from '../data/sample';
import { validatedTool } from './validated';

export const readBudget = validatedTool(z.strictObject({ code: z.string().optional() }), {
  name: 'read_budget',
  description:
    'อ่านชีตงบตัวอย่างของกลุ่มสาระ (ตัวจำลอง: ข้อมูลตัวอย่าง ไม่ใช่งบจริงของโรงเรียน) คืนรายการ งบ ใช้ไป และคงเหลือที่ระบบคำนวณ',
  gate: 'allow',
  execute: ({ code }) => {
    const lines = budgetSheet.lines
      .filter((l) => !code || l.code === code)
      .map((l) => ({ ...l, remaining: l.budget - l.spent }));
    return { mode: 'mock', title: budgetSheet.title, unit: budgetSheet.unit, lines };
  },
});
