import { budgetSheet } from '../data/sample';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

const buddhistDate = (date: Date) =>
  new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    dateStyle: 'long',
    timeZone: 'Asia/Bangkok',
  }).format(date);

export const fillClaimForm: ToolDefinition = {
  name: 'fill_claim_form',
  description:
    'กรอกแบบฟอร์มเบิกตัวอย่าง (ยังไม่ใช่แบบของโรงเรียน) จากรายการที่ระบุ ยอดรวมและงบคงเหลือคำนวณโดยระบบ วันที่เป็น พ.ศ. ลายเซ็นเว้นว่าง',
  input: {
    type: 'object',
    properties: {
      budgetCode: { type: 'string' },
      purpose: { type: 'string' },
      items: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            qty: { type: 'number', exclusiveMinimum: 0 },
            unitPrice: { type: 'number', minimum: 0 },
          },
          required: ['name', 'qty', 'unitPrice'],
          additionalProperties: false,
        },
      },
    },
    required: ['budgetCode', 'purpose', 'items'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => {
    const { budgetCode, purpose, items } = input as {
      budgetCode: string;
      purpose: string;
      items: { name: string; qty: number; unitPrice: number }[];
    };
    const line = budgetSheet.lines.find((l) => l.code === budgetCode);
    if (!line)
      throw new ToolError('unknown_budget_code', `ไม่พบรหัสงบ ${budgetCode} ในชีตตัวอย่าง`);
    const rows = items.map((i) => ({ ...i, amountSatang: Math.round(i.qty * i.unitPrice * 100) }));
    const totalSatang = rows.reduce((sum, r) => sum + r.amountSatang, 0);
    const remainingSatang = (line.budget - line.spent) * 100 - totalSatang;
    return {
      mode: 'mock',
      label: 'ตัวอย่าง — ยังไม่ใช่แบบฟอร์มของโรงเรียน',
      claimId: 'claim-' + crypto.randomUUID().slice(0, 8),
      date: buddhistDate(new Date()),
      budgetCode,
      purpose,
      rows: rows.map((r) => ({
        name: r.name,
        qty: r.qty,
        unitPrice: r.unitPrice,
        amount: r.amountSatang / 100,
      })),
      total: totalSatang / 100,
      remainingAfter: remainingSatang / 100,
      overBudget: remainingSatang < 0,
      signature: null,
    };
  },
};
