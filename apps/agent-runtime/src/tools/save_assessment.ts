import { createHash } from 'node:crypto';
import type { Assessment } from '../lib/fractions';
import { z } from 'zod';
import { classesOf, normalizeClassLabel } from '../data/accounts';
import { schoolTool, type SchoolScope } from '../school';
import { recordForm } from '../state';
import { assessmentSchema, runCheck } from './check_assessment';
import { classOf, ownerOf, ToolError } from './identity';
import { validatedTool } from './validated';

const formResponse = z.object({
  ok: z.literal(true),
  formId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  url: z
    .string()
    .regex(/^https:\/\/docs\.google\.com\/forms\/d\/(?:e\/)?[A-Za-z0-9_-]+\/viewform(?:[?#].*)?$/),
});

type PublishedForm = {
  mode: 'apps-script' | 'mock' | 'school';
  formId: string;
  url: string;
  /** The order and key actually published. */
  questions: ReturnType<typeof formQuestions>;
};

export function formQuestions(questions: Assessment['questions']) {
  const availableBySize = new Map<number, number[]>();
  const seed = createHash('sha256')
    .update(JSON.stringify(questions.map((q) => [q.id, q.text])))
    .digest();
  return questions.map(({ text, choices, correctChoiceId }, index) => {
    const original = choices.findIndex((choice) => choice.id === correctChoiceId);
    if (original < 0) throw new ToolError('invalid_assessment', 'ไม่พบตัวเลือกที่ถูก');

    // Draw every position once before reusing one for questions of the same size.
    let positions = availableBySize.get(choices.length);
    if (!positions?.length) {
      positions = choices.map((_, i) => i);
      availableBySize.set(choices.length, positions);
    }
    const answerIndex = positions.splice(seed[index % seed.length]! % positions.length, 1)[0]!;
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

const saveInputSchema = assessmentSchema.extend({ classLabel: z.string().max(40).optional() });

function namedClassId(ownerId: string, grade: string, classLabel: string | undefined) {
  const rooms = classesOf(ownerId);
  for (const wanted of [classLabel, grade]) {
    if (!wanted) continue;
    const label = normalizeClassLabel(wanted);
    const room = rooms.find(
      (room) => room.id === wanted.trim() || normalizeClassLabel(room.label) === label,
    );
    if (room) return room.id;
  }
}

function gradeClassId(ownerId: string, grade: string) {
  const rooms = classesOf(ownerId);
  const level = normalizeClassLabel(grade);
  const matching = rooms.filter(({ label }) => normalizeClassLabel(label).split('/')[0] === level);
  return matching.length === 1 ? matching[0]?.id : undefined;
}

export const saveAssessment = validatedTool(saveInputSchema, {
  name: 'save_assessment',
  description:
    'ตรวจเฉลยด้วยโค้ดอีกรอบ แล้วสร้างแบบทดสอบ Google Form คืน formUrl และ mode ใช้หลัง check_assessment ผ่านเท่านั้น ห้ามแต่งลิงก์เอง ถ้าครูระบุห้อง ให้ใส่ classLabel เช่น ม.2/1 เพื่อให้ get_scores อ่านคำตอบของห้องนั้น ระบบสลับตัวเลือกให้เฉลยกระจายก่อนสร้างฟอร์ม และคืน questions (ลำดับตัวเลือกและเฉลย ก-ง ที่ใช้จริง) ให้ใช้ตอนแสดงร่างให้ครู ถ้าชุดไม่ผ่านจะไม่สร้างอะไร เมื่อบันทึกฟอร์มให้ห้องสำเร็จ get_scores ใช้ mode form เมื่อมีคำตอบทดสอบ หรือ mode sample เมื่อใช้ข้อมูลตัวอย่าง',
  gate: 'allow',
  execute: async ({ classLabel, ...input }, context) => {
    const published = await saveVerifiedAssessment(input, context.signal, context.scope);
    if (published.mode === 'apps-script') {
      const ownerId = ownerOf(context).id;
      const classId =
        namedClassId(ownerId, input.grade, classLabel) ??
        classOf(context) ??
        gradeClassId(ownerId, input.grade);
      if (classId) {
        recordForm({
          formId: published.formId,
          classId,
          ownerId,
          title: input.title,
          topic: input.topic,
          questionTopics: input.questions.map(({ topic }) => topic),
          maxScore: published.maxScore,
          createdAt: Date.now(),
        });
      }
    }
    return published;
  },
});

export async function saveVerifiedAssessment(
  input: z.infer<typeof assessmentSchema>,
  signal: AbortSignal,
  scope?: SchoolScope,
) {
  const { assessment, result } = runCheck(input, { defaultFloor: true });
  if (!result.ok || result.unverified.length) {
    const reasons = result.errors.map((error) => error.message).concat(result.unverified);
    throw new ToolError('invalid_assessment', reasons.join('; '));
  }
  const bridgeStarted = performance.now();
  const { mode, formId, url, questions } = scope
    ? await saveSchoolAssessment(scope, assessment, signal)
    : await publisher.publish(assessment, signal);
  const bridgeElapsedMs = Math.round(performance.now() - bridgeStarted);
  const published = questions.map((question, index) => ({
    id: assessment.questions[index]?.id,
    text: question.text,
    choices: question.choices,
    points: question.points,
    answer: 'กขคง'[question.answerIndex],
  }));
  return {
    formUrl: url,
    mode,
    formId,
    questions: published,
    bridgeElapsedMs,
    maxScore: questions.length,
  };
}

async function saveSchoolAssessment(
  scope: SchoolScope,
  assessment: Assessment,
  signal: AbortSignal,
): Promise<PublishedForm> {
  const questions = formQuestions(assessment.questions);
  const ordered = {
    ...assessment,
    questions: assessment.questions.map((q, index) => ({
      ...q,
      choices: questions[index]!.choices.map((text, position) => ({ id: `c${position}`, text })),
      correctChoiceId: `c${questions[index]!.answerIndex}`,
    })),
  };
  const invocationId = createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
  const result = z
    .object({ id: z.string(), formUrl: z.string(), worksheetUrl: z.string() })
    .parse(
      await schoolTool(scope, 'save_assessment', { assessment: ordered, invocationId }, signal),
    );
  return { mode: 'school', formId: result.id, url: result.formUrl, questions };
}
