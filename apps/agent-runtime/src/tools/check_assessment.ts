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
            items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false },
          },
          correctChoiceId: { type: 'string' },
          topic: { type: 'string' },
          explanation: { type: 'string' },
          verify: { type: 'object', properties: { expr: { type: 'string' }, expected: { type: 'string' } }, required: ['expr', 'expected'], additionalProperties: false },
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
  return { assessment, result: checkAssessment(assessment, { expectedCount }) };
}

export const checkAssessmentTool: ToolDefinition = {
  name: 'check_assessment',
  description:
    'ตรวจชุดข้อสอบด้วยโค้ด: คำนวณเศษส่วนจริง ตรวจเฉลย ตัวเลือกที่ค่าเท่ากันหลังย่อ และจำนวนข้อ (expectedCount = จำนวนที่ครูขอ) การหารเขียน (4/7)/(2/7) ถ้า ok เป็น false ให้แก้ตาม errors แล้วเรียกใหม่',
  input: assessmentSchema,
  gate: 'allow',
  execute: (input) => runCheck(input).result,
};
