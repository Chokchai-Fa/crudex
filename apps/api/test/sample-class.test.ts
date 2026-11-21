import { expect, it } from 'vitest';
import { sampleClassM21 } from '@repo/shared';
import type { Db } from '../src/db/client';
import { assessments, submissions } from '../src/db/schema/classroom';
import { sampleHistoryInserts } from '../src/repositories/sample-class.repository';

it('builds 3 sample ม.2/1 assessments with the runtime scores for 8 students', () => {
  const inserted: { table: unknown; values: unknown }[] = [];
  const db = {
    insert: (table: unknown) => ({
      values: (values: unknown) => {
        inserted.push({ table, values });
        return { table, values };
      },
    }),
  } as unknown as Db;
  const students = sampleClassM21.studentNames.map(() => crypto.randomUUID());
  sampleHistoryInserts(db, crypto.randomUUID(), crypto.randomUUID(), students);
  const works = inserted
    .filter((i) => i.table === assessments)
    .map((i) => i.values as never as { content: { title: string; questions: unknown[] } });
  expect(works.map((w) => w.content.title)).toEqual(sampleClassM21.assessments.map((a) => a.title));
  expect(works.every((w) => w.content.questions.length === 6)).toBe(true);
  const scores = inserted
    .filter((i) => i.table === submissions)
    .map((i) =>
      (i.values as { score: number; maxScore: number }[]).map((r) => `${r.score}/${r.maxScore}`),
    );
  // Latest (Pythagoras) assessment: 28/48 in total, mean 3.5/6, as in the runtime.
  expect(scores[2]).toEqual(['4/6', '3/6', '5/6', '2/6', '3/6', '4/6', '6/6', '1/6']);
  expect(scores.map((s) => s.length)).toEqual([8, 8, 8]);
});
