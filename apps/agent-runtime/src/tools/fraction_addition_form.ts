import { z } from 'zod';
import { evalExpr, show } from '../lib/fractions';
import { checkFailureCount, resetCheckFailures } from './check-failures';
import { saveVerifiedAssessment } from './save_assessment';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

const inputSchema = z.object({ count: z.number().int().min(1).max(30) }).strict();
const indicator = 'ค 1.1 ป.5/3';

// Begin with related denominators, then introduce unlike denominators.
const denominators = [
  [3, 6],
  [4, 8],
  [5, 10],
  [6, 9],
  [4, 6],
  [5, 8],
  [3, 7],
  [8, 12],
  [6, 10],
  [5, 12],
] as const;

export function additionWorksheet(count: number) {
  const questions = Array.from({ length: count }, (_, index) => {
    const [b, d] = denominators[index % denominators.length]!;
    const round = Math.floor(index / denominators.length);
    const a = 1 + ((index + round) % (b - 1));
    const c = 1 + (((index % denominators.length) * 2 + round) % (d - 1));
    const expr = `${a}/${b} + ${c}/${d}`;
    const expected = show(evalExpr(expr));
    // Wrong strategies: add denominators, keep just one denominator, or multiply.
    const candidates = [
      expected,
      `${a + c}/${b + d}`,
      `${a + c}/${d}`,
      `${a + c}/${b}`,
      `${a * c}/${b * d}`,
      `${a + c}/${b * d}`,
    ];
    const values = [...new Set(candidates.map((value) => show(evalExpr(value))))].slice(0, 4);
    return {
      id: `q${index + 1}`,
      text: `${expr} เท่ากับข้อใด`,
      topic: 'การบวกเศษส่วน',
      indicator,
      choices: values.map((text, position) => ({ id: `c${position}`, text })),
      correctChoiceId: 'c0',
      verify: { expr, expected },
    };
  });
  return {
    title: 'ใบงานบวกเศษส่วน ป.5',
    grade: 'ป.5',
    topic: 'การบวกเศษส่วน',
    expectedCount: count,
    questions,
  };
}

export const fractionAdditionForm: ToolDefinition = {
  name: 'fraction_addition_form',
  description:
    'ใช้เป็นทางสำรองเมื่อ check_assessment คืน ok เป็น false สองครั้งติดกันในเซสชันเดียวกัน จ๋ำสร้างใบงานปรนัย 4 ตัวเลือก เรื่องการบวกเศษส่วน ป.5 ตรวจทุกข้อด้วยโค้ด และสร้าง Google Form จริงในครั้งเดียว ใส่จำนวนข้อเท่านั้น ระบบแสดงใบงาน เฉลยและลิงก์ในแชตโดยตรง',
  input: {
    type: 'object',
    properties: { count: { type: 'integer', minimum: 1, maximum: 30 } },
    required: ['count'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: async (input, context) => {
    if (checkFailureCount(context.sessionID) < 2) {
      throw new ToolError(
        'fallback_not_allowed',
        'ให้เขียนโจทย์เองและเรียก check_assessment ตรวจก่อน ใช้แบบมาตรฐานได้เมื่อผลตรวจไม่ผ่านสองครั้งติดกัน',
      );
    }
    const { count } = inputSchema.parse(input);
    const assessment = additionWorksheet(count);
    const published = await saveVerifiedAssessment(assessment, context.signal);
    if (published.questions?.length !== count)
      throw new ToolError('unavailable', 'ไม่พบลำดับตัวเลือกที่ส่งเข้า Form');
    const questions = published.questions.map((question, index) => {
      const stem = assessment.questions[index]!.text;
      const choices = question.choices.map((text, i) => `${'กขคง'[i]}. ${text}`).join('   ');
      return `${index + 1}. ${stem}\n${choices}`;
    });
    const keys = published.questions
      .map(({ answer }, index) => `${index + 1}. ${answer}`)
      .join('   ');
    const worksheet = [
      `${assessment.title} · ${count} ข้อ · ${indicator}`,
      ...questions,
      'เฉลย: ' + keys,
      `สร้างโจทย์จากแบบฝึกบวกเศษส่วนและตรวจเฉลยด้วยโค้ดครบ ${count} ข้อ · ครูตรวจก่อนใช้`,
      published.formUrl,
    ].join('\n\n');
    resetCheckFailures(context.sessionID);
    return {
      worksheet,
      formUrl: published.formUrl,
      mode: published.mode,
      bridgeElapsedMs: published.bridgeElapsedMs,
    };
  },
};
