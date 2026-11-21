import { indicators } from '../data/indicators';
import { checkAssessment, type Assessment } from '../lib/fractions';
import type { ToolDefinition } from './types';

export const assessmentSchema = {
  type: 'object',
  properties: {
    expectedCount: { type: 'integer', minimum: 1, maximum: 30 },
    title: { type: 'string' },
    grade: { type: 'string' },
    topic: { type: 'string' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          text: { type: 'string' },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: { id: { type: 'string' }, text: { type: 'string' } },
              required: ['id', 'text'],
              additionalProperties: false,
            },
          },
          correctChoiceId: { type: 'string' },
          topic: { type: 'string' },
          indicator: { type: 'string', description: 'รหัสตัวชี้วัดจาก curriculum_lookup ตรงตัว' },
          explanation: { type: 'string' },
          verify: {
            type: 'object',
            properties: { expr: { type: 'string' }, expected: { type: 'string' } },
            required: ['expr', 'expected'],
            additionalProperties: false,
          },
        },
        required: ['id', 'text', 'choices', 'correctChoiceId', 'topic'],
      },
    },
  },
  required: ['title', 'grade', 'topic', 'questions'],
  additionalProperties: false,
} as const;

export function runCheck(input: unknown) {
  const { expectedCount, ...assessment } = input as Assessment & { expectedCount?: number };
  const result = checkAssessment(assessment, { expectedCount });
  const known = new Set(indicators.map((i) => i.id));
  for (const question of assessment.questions as { id: string; indicator?: string }[]) {
    if (question.indicator !== undefined && !known.has(question.indicator)) {
      result.errors.push({
        questionId: question.id,
        code: 'unknown_indicator',
        message: `ไม่พบตัวชี้วัด ${question.indicator} ใช้รหัสจาก curriculum_lookup ตรงตัว`,
      });
      result.ok = false;
    }
  }
  return { assessment, result };
}

export const checkAssessmentTool: ToolDefinition = {
  name: 'check_assessment',
  description:
    'ตรวจชุดข้อสอบด้วยโค้ด: คำนวณเศษส่วนจริง ตรวจเฉลย ตัวเลือกที่ค่าเท่ากันหลังย่อ และจำนวนข้อ (expectedCount = จำนวนที่ครูขอ) การหารเขียน (4/7)/(2/7) ถ้า ok เป็น false ให้แก้ตาม errors แล้วเรียกใหม่',
  input: assessmentSchema,
  gate: 'allow',
  execute: (input) => runCheck(input).result,
};
