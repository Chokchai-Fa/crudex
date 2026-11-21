import { evalExpr, show } from '../lib/fractions';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

export function calculate(expr: string) {
  try {
    const value = evalExpr(expr);
    const decimal = Number(value.n) / Number(value.d);
    return { expr, exact: show(value), decimal: Math.round(decimal * 1e6) / 1e6 };
  } catch (error) {
    throw new ToolError('bad_expression', error instanceof Error ? error.message : 'คำนวณไม่ได้');
  }
}

export const calc: ToolDefinition = {
  name: 'calc',
  description:
    'คิดเลขแม่นยำ (เศษส่วน/ทศนิยม + - * / และวงเล็บ) ตัวเลขทุกตัวในเอกสารต้องมาจากเครื่องมือนี้ ห้ามคิดเอง การหารเขียน (4/7)/(2/7)',
  input: {
    type: 'object',
    properties: { expr: { type: 'string' } },
    required: ['expr'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => calculate((input as { expr: string }).expr),
};
