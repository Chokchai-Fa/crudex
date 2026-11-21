import { z } from 'zod';

const label = z.string().trim().min(1).max(500);
export const assessmentContentSchema = z.object({
  title: label,
  grade: label,
  topic: label,
  expectedCount: z.int().min(1).max(30).optional(),
  questions: z
    .array(
      z.object({
        id: label,
        text: z.string().min(1).max(8000),
        topic: label,
        choices: z
          .array(z.object({ id: label, text: z.string().min(1).max(2048) }))
          .min(2)
          .max(30),
        correctChoiceId: label,
        indicator: label.optional(),
        explanation: z.string().max(8000).optional(),
        verify: z
          .object({ expr: z.string().min(1).max(256), expected: z.string().min(1).max(256) })
          .optional(),
      }),
    )
    .min(1)
    .max(30),
});
export type AssessmentContent = z.infer<typeof assessmentContentSchema>;
export const saveWorksheetSchema = z.object({
  assessment: assessmentContentSchema,
  invocationId: label,
});
export const submissionSchema = z.strictObject({ answers: z.record(label, label) });
export const routineSchema = z.strictObject({
  classId: z.uuid(),
  hour: z.int().min(0).max(23),
  minute: z.int().min(0).max(59),
});
export const routineUpdateSchema = z.strictObject({ enabled: z.boolean() });
export const briefDateSchema = z.object({ date: z.iso.date().optional() });
