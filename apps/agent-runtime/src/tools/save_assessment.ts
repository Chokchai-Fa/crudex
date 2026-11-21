import { randomInt } from 'node:crypto';
import type { Assessment } from '../lib/fractions';
import { z } from 'zod';
import { assessmentSchema, runCheck } from './check_assessment';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

const formResponse = z.object({
  ok: z.literal(true),
  formId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  url: z
    .string()
    .regex(/^https:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform(?:[?#].*)?$/),
});

type PublishedForm = {
  mode: 'apps-script' | 'mock';
  formId: string;
  url: string;
  /** The order and key actually published; the teacher must be shown this, not the order the model sent. */
  questions?: ReturnType<typeof formQuestions>;
};

export function formQuestions(questions: Assessment['questions']) {
  const availableBySize = new Map<number, number[]>();
  return questions.map(({ text, choices, correctChoiceId }) => {
    const original = choices.findIndex((choice) => choice.id === correctChoiceId);
    if (original < 0) throw new ToolError('invalid_assessment', 'ไม่พบตัวเลือกที่ถูก');

    // Draw every position once before reusing one for questions of the same size.
    let positions = availableBySize.get(choices.length);
    if (!positions?.length) {
      positions = choices.map((_, i) => i);
      availableBySize.set(choices.length, positions);
    }
    const answerIndex = positions.splice(randomInt(positions.length), 1)[0]!;
    const ordered = [...choices];
    [ordered[original], ordered[answerIndex]] = [ordered[answerIndex]!, ordered[original]!];
    return { text, choices: ordered.map((choice) => choice.text), answerIndex, points: 1 };
  });
}

export const publisher = {
  async publish(assessment: Assessment, signal: AbortSignal): Promise<PublishedForm> {
    const endpoint = process.env.SCHOOL_BOT_APPS_SCRIPT_URL;
    if (!endpoint) throw new ToolError('unavailable', 'ยังไม่ได้เชื่อมต่อ Google Form');

    const questions = formQuestions(assessment.questions);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'createQuiz',
          title: assessment.title,
          description: [assessment.grade, assessment.topic, '(ข้อมูลตัวอย่าง)'].join(' '),
          questions,
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
      });
      if (response.ok) {
        const result = formResponse.safeParse(await response.json());
        if (result.success)
          return {
            mode: 'apps-script',
            formId: result.data.formId,
            url: result.data.url,
            questions,
          };
      }
    } catch {
      // Fetch errors and bridge responses may contain the private deployment URL.
    }
    throw new ToolError('unavailable', 'ยังยืนยันการสร้าง Google Form ไม่ได้');
  },
};

export const saveAssessment: ToolDefinition = {
  name: 'save_assessment',
  description:
    'ตรวจเฉลยด้วยโค้ดอีกรอบ แล้วสร้างแบบทดสอบ Google Form คืน formUrl และ mode ใช้หลัง check_assessment ผ่านเท่านั้น ห้ามแต่งลิงก์เอง ระบบสลับตัวเลือกให้เฉลยกระจายก่อนสร้างฟอร์ม และคืน questions (ลำดับตัวเลือกและเฉลย ก-ง ที่ใช้จริง) ให้ใช้ตอนแสดงร่างให้ครู ถ้าชุดไม่ผ่านจะไม่สร้างอะไร',
  input: assessmentSchema,
  gate: 'allow',
  execute: async (input, context) => {
    const { assessment, result } = runCheck(input);
    if (!result.ok || result.unverified.length) {
      const reasons = result.errors.map((error) => error.message).concat(result.unverified);
      throw new ToolError('invalid_assessment', reasons.join('; '));
    }
    const { mode, formId, url, questions } = await publisher.publish(assessment, context.signal);
    const published = questions?.map((question, index) => ({
      id: assessment.questions[index]?.id,
      choices: question.choices,
      answer: 'กขคง'[question.answerIndex],
    }));
    return { formUrl: url, mode, formId, questions: published };
  },
};
