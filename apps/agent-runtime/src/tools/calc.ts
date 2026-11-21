import { z } from 'zod';
import { evalExpr, show } from '../lib/fractions';
import { ToolError } from './identity';
import { nonBlank, validatedTool } from './validated';

export const calc = validatedTool(z.strictObject({ expr: nonBlank.max(2048) }), {
  name: 'calc',
  description:
    'คิดเลขแม่นยำ (เศษส่วน/ทศนิยม + - * / และวงเล็บ) ใช้เมื่อต้องคำนวณตัวเลขเพิ่ม ห้ามคิดเอง การหารเขียน (4/7)/(2/7)',
  gate: 'allow',
  execute: ({ expr }) => {
    try {
      const value = evalExpr(expr);
      const scaled = value.n * 1_000_000n;
      const remainder = scaled % value.d;
      // Match Math.round's tie direction while the value is still an exact fraction.
      const adjustment = 2n * remainder >= value.d ? 1n : 2n * remainder < -value.d ? -1n : 0n;
      const decimal = Number(`${scaled / value.d + adjustment}e-6`);
      return { expr, exact: show(value), decimal: Number.isFinite(decimal) ? decimal : null };
    } catch (error) {
      throw new ToolError('bad_expression', error instanceof Error ? error.message : 'คำนวณไม่ได้');
    }
  },
});
