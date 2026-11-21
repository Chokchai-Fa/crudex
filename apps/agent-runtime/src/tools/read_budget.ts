import { z } from 'zod';
import { budgetSheet, sampleOwner } from '../data/sample';
import { activities, principalOwner } from '../data/school';
import { ownerOf, ToolError } from './identity';
import { validatedTool } from './validated';

export const readBudget = validatedTool(z.strictObject({ code: z.string().optional() }), {
  name: 'read_budget',
  description:
    'อ่านชีตงบตัวอย่างของกลุ่มสาระ (ตัวจำลอง: ข้อมูลตัวอย่าง ไม่ใช่งบจริงของโรงเรียน) คืนรายการ งบ ใช้ไป และคงเหลือที่ระบบคำนวณ',
  gate: 'allow',
  execute: ({ code }, context) => {
    const owner = ownerOf(context).id;
    if (owner !== sampleOwner && owner !== principalOwner)
      throw new ToolError('no_budget', 'ยังไม่มีงบที่มอบหมายให้บัญชีนี้');
    const sheet =
      owner === principalOwner
        ? {
            title: 'ตัวอย่าง: งบกิจกรรมระดับโรงเรียน',
            unit: 'บาท',
            lines: activities.map(({ name, ...line }) => ({ ...line, item: name })),
          }
        : budgetSheet;
    const lines = sheet.lines
      .filter((l) => !code || l.code === code)
      .map((l) => ({ ...l, remaining: l.budget - l.spent }));
    return { mode: 'mock', title: sheet.title, unit: sheet.unit, lines };
  },
});
