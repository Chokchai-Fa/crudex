import { z } from 'zod';
import { curriculumIndicators as indicators } from '../data/curriculum';
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
    },
  };
}

export const checkAssessmentTool = validatedTool(assessmentSchema, {
  name: 'check_assessment',
  description:
    'ตรวจชุดข้อสอบด้วยโค้ด: คำนวณเศษส่วนจริง ตรวจเฉลย ตัวเลือกที่ค่าเท่ากันหลังย่อ และจำนวนข้อ (expectedCount = จำนวนที่ครูขอ) การหารเขียน (4/7)/(2/7) ถ้า ok เป็น false ให้แก้ตาม errors แล้วเรียกใหม่',
  gate: 'allow',
  execute: (input, context) => {
    const { result } = runCheck(input, { defaultFloor: true });
    recordCheckResult(context.sessionID, result.ok);
    return result;
  },
});
