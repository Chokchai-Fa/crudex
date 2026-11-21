import { sampleClassM21, type AssessmentContent } from '@repo/shared';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { assessments, submissions } from '../db/schema/classroom';
import {
  classAssignments,
  schoolAccounts,
  schoolClasses,
  schoolMemberships,
} from '../db/schema/schools';

/** Sample (ตัวอย่าง) Form content for one past assessment: one two-choice item per question topic. */
function sampleContent(a: (typeof sampleClassM21.assessments)[number]): AssessmentContent {
  return {
    title: a.title,
    grade: sampleClassM21.grade,
    topic: a.topic,
    questions: a.questionTopics.map((topic, i) => ({
      id: `q${i + 1}`,
      text: `ตัวอย่าง: ข้อ ${i + 1} เรื่อง${topic}`,
      topic,
      indicator: a.indicator,
      choices: [
        { id: 'a', text: 'คำตอบที่ถูก (ตัวอย่าง)' },
        { id: 'b', text: 'คำตอบที่ผิด (ตัวอย่าง)' },
      ],
      correctChoiceId: 'a',
    })),
  };
}

/** Insert statements for the sample students' past scores; students[i] answers results[i]. */
export function sampleHistoryInserts(
  db: Db,
  schoolId: string,
  classId: string,
  studentIds: readonly string[],
) {
  const runId = crypto.randomUUID();
  return sampleClassM21.assessments.flatMap((a) => {
    const id = crypto.randomUUID();
    const at = new Date(a.date + 'T02:00:00Z'); // 09:00 Bangkok
    const rows = a.results.flatMap((row, i) => {
      const studentId = studentIds[i];
      if (!studentId) return [];
      const answers = Object.fromEntries(
        [...row].map((c, q) => [`q${q + 1}`, c === '1' ? 'a' : 'b']),
      );
      const score = [...row].filter((c) => c === '1').length;
      return [{ assessmentId: id, studentId, answers, score, maxScore: row.length, createdAt: at }];
    });
    return [
      db.insert(assessments).values({
        id,
        schoolId,
        classId,
        runId,
        invocationId: 'sample-history-' + id,
        content: sampleContent(a),
        createdAt: at,
      }),
      ...(rows.length ? [db.insert(submissions).values(rows)] : []),
    ];
  });
}

/**
 * One-time admin seed for an existing class (e.g. the stage teacher's ม.2/1): adds the 8 sample
 * students and their 3 past scores. Refuses a class that already has assessments, so a retry is safe.
 */
export async function seedSampleClass(db: Db, schoolId: string, classId: string) {
  const [room] = await db
    .select({ id: schoolClasses.id })
    .from(schoolClasses)
    .where(and(eq(schoolClasses.id, classId), eq(schoolClasses.schoolId, schoolId)));
  if (!room) return undefined;
  const existing = await db
    .select({ id: assessments.id })
    .from(assessments)
    .where(and(eq(assessments.schoolId, schoolId), eq(assessments.classId, classId)))
    .limit(1);
  if (existing.length) return { id: classId, seeded: false };
  const people = sampleClassM21.studentNames.map((displayName) => ({
    ownerId: crypto.randomUUID(),
    id: crypto.randomUUID(),
    displayName,
  }));
  await db.batch([
    db
      .insert(schoolAccounts)
      .values(people.map((p) => ({ id: p.ownerId, displayName: p.displayName }))),
    db
      .insert(schoolMemberships)
      .values(
        people.map((p) => ({ id: p.id, ownerId: p.ownerId, role: 'student' as const, schoolId })),
      ),
    db
      .insert(classAssignments)
      .values(people.map((p) => ({ schoolId, classId, membershipId: p.id }))),
    ...sampleHistoryInserts(
      db,
      schoolId,
      classId,
      people.map((p) => p.id),
    ),
  ] as unknown as Parameters<Db['batch']>[0]);
  return { id: classId, seeded: true };
}
