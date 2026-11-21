import { z } from 'zod';
import { curriculumIndicators as indicators } from '../data/curriculum';
import { renderWorksheet } from '../lib/answer-positions';
import {
  choiceIssues,
  pythagoreanIssues,
  reuseIssue,
  type SemanticQuestion,
} from '../lib/assessment-semantics';
import { checkAssessment } from '../lib/fractions';
import { recordCheckResult } from './check-failures';
import { nonBlank, validatedTool } from './validated';

export const assessmentSchema = z.strictObject({
  expectedCount: z.int().min(1).max(30).optional(),
  title: nonBlank,
  grade: nonBlank,
  topic: nonBlank,
  questions: z
    .array(
      z.strictObject({
        id: nonBlank,
        text: nonBlank.max(8000),
        choices: z.array(z.strictObject({ id: nonBlank, text: nonBlank.max(2048) })).max(30),
        correctChoiceId: nonBlank,
        topic: nonBlank,
        indicator: nonBlank.optional(),
        pythagorean: z
          .strictObject({
            legA: z.number().positive(),
            legB: z.number().positive(),
            hypotenuse: z.number().positive(),
            ask: z.enum(['legA', 'legB', 'hypotenuse']),
          })
          .optional(),
        explanation: z.string().optional(),
        verify: z
          .strictObject({
            expr: nonBlank.max(2048),
            expected: nonBlank.max(2048),
          })
          .optional(),
      }),
    )
    .max(30),
});

export const DEFAULT_MIN_QUESTIONS = 5;

export function runCheck(
  { expectedCount, ...assessment }: z.infer<typeof assessmentSchema>,
  { defaultFloor = false }: { defaultFloor?: boolean } = {},
) {
  // Without an explicit count the teacher did not ask for a short set: refuse anything under the default floor.
  const result = checkAssessment(assessment, {
    expectedCount,
    minQuestions: defaultFloor && expectedCount === undefined ? DEFAULT_MIN_QUESTIONS : 1,
  });
  const known = new Set(indicators.map((i) => i.id));
  for (const question of assessment.questions) {
    if (question.indicator !== undefined && !known.has(question.indicator)) {
      result.errors.push({
        questionId: question.id,
        code: 'unknown_indicator',
        message: `ไม่พบตัวชี้วัด ${question.indicator} ใช้รหัสจาก curriculum_lookup ตรงตัว`,
      });
      result.ok = false;
    }
  }
  for (const question of assessment.questions as SemanticQuestion[]) {
    const { issues: roleIssues, verified } = pythagoreanIssues(question);
    const issues = [...roleIssues, ...choiceIssues(question)];
    if (issues.length) {
      result.errors.push(...issues);
      result.ok = false;
    }
    if (!verified && !result.unverified.includes(question.id)) result.unverified.push(question.id);
    if (!verified) result.verified = result.verified.filter((id) => id !== question.id);
  }
  const byTopic = new Map<string, number>();
  for (const question of assessment.questions) {
    byTopic.set(question.topic, (byTopic.get(question.topic) ?? 0) + 1);
  }
  return {
    assessment,
    result: {
      ...result,
      count: assessment.questions.length,
      verifiedCount: result.verified.length,
      unverifiedCount: result.unverified.length,
      topics: [...byTopic].map(([topic, count]) => ({ topic, count })),
      // The worksheet for the chat, rendered by code with the keys spread over ก-ง. Paste it as is; never reorder or relabel.
      worksheet: result.ok ? renderWorksheet(assessment.questions) : undefined,
    },
  };
}

export const checkAssessmentTool = validatedTool(assessmentSchema, {
  name: 'check_assessment',
  description:
    'ตรวจชุดข้อสอบด้วยโค้ด: คำนวณเศษส่วนจริง ตรวจเฉลย ตัวเลือกที่ค่าเท่ากันหลังย่อ และจำนวนข้อ (expectedCount = จำนวนที่ครูขอ) การหารเขียน (4/7)/(2/7) ข้อพีทาโกรัสต้องใส่ pythagorean {legA, legB, hypotenuse, ask} ระบุขา 2 ด้านกับด้านตรงข้ามมุมฉากและด้านที่ถาม ถ้าไม่ใส่ข้อนั้นจะนับเป็นยังไม่ได้ตรวจด้วยโค้ด ชุดที่ใช้ตัวเลขซ้ำกับชุดก่อนหน้าในเซสชันเดียวกันจะไม่ผ่าน ยกกำลังเขียน 7^2 รากที่สองเขียน sqrt(625) (ใช้ได้เมื่อลงตัวพอดีเท่านั้น) ถ้า ok เป็น true ผลมี worksheet.text (ใบงานที่ระบบเรียงตัวเลือกและติดป้าย ก-ง แล้ว) กับ worksheet.answers (เฉลย) ให้วางทั้งสองตามตัวอักษรในแชตเป็นข้อความธรรมดา ห้ามครอบด้วย code fence ห้ามเรียงใหม่ ห้ามเปลี่ยนป้ายหรือเลข ตัวเลือกต้องไม่เรียงห่างเท่ากัน ถ้า ok เป็น false ให้แก้ตาม errors แล้วเรียกใหม่',
  gate: 'allow',
  execute: (input, context) => {
    const { assessment, result } = runCheck(input, { defaultFloor: true });
    if (result.ok) {
      const reused = reuseIssue(context.sessionID ?? 'no-session', assessment.questions);
      if (reused) {
        result.errors.push({ code: 'reused_numbers', message: reused });
        result.ok = false;
      }
    }
    recordCheckResult(context.sessionID, result.ok);
    return result;
  },
});
