import { describe, expect, it } from 'vitest';
import { classHistories, teacherClasses } from '../src/data/class-history';
import { pastAssessments, untaughtDemoClass } from '../src/data/class-score-history';
import { curriculumTopics } from '../src/data/curriculum';
import { sampleOwner } from '../src/data/sample';
import { tools } from '../src/tools';
import type { ToolContext } from '../src/tools/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolResult = Record<string, any>;
const ctx = (extra: Partial<ToolContext> = {}): ToolContext => ({
  count: 1,
  signal: new AbortController().signal,
  ownerId: sampleOwner,
  ...extra,
});
const getScores = async (input: unknown, context = ctx()) => {
  const tool = tools.find((t) => t.name === 'get_scores');
  if (!tool) throw new Error('missing get_scores');
  return (await tool.execute(input, context)) as ToolResult;
};

describe('sample class histories (ตัวอย่าง)', () => {
  it('the demo teacher teaches ป.5/2 and ม.2/1 but not ม.2/3', () => {
    const labels = (teacherClasses[sampleOwner] ?? []).map((room) => room.label);
    expect(labels).toEqual(expect.arrayContaining(['ป.5/2', 'ม.2/1']));
    expect(labels).not.toContain(untaughtDemoClass.label);
    expect(pastAssessments[untaughtDemoClass.id]?.length).toBeGreaterThan(0);
  });

  it.each(['class-p5-2', 'class-m2-1'])('%s has 2–3 past assessments, latest last', (classId) => {
    const past = pastAssessments[classId] ?? [];
    expect(past.length).toBeGreaterThanOrEqual(2);
    expect(past.length).toBeLessThanOrEqual(3);
    expect(past.at(-1)?.assessment).toEqual(classHistories[classId]?.assessment);
    const dates = past.map((p) => p.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('every row is well formed, labelled as sample, and topics come from the curriculum', () => {
    for (const [classId, past] of Object.entries(pastAssessments)) {
      for (const item of past) {
        const { assessment, questionTopics, results } = item;
        expect(assessment.title, classId).toMatch(/^ตัวอย่าง: /);
        expect(assessment.maxScore).toBe(questionTopics.length);
        for (const row of results)
          expect(row).toMatch(new RegExp(`^[1x]{${questionTopics.length}}$`));
        for (const topic of new Set(questionTopics)) {
          const match = curriculumTopics.find((t) => t.topic === topic);
          expect(match, `${classId} ${topic}`).toBeDefined();
          if (assessment.indicator)
            expect(assessment.indicator.split(' ').at(-1)).toMatch(match?.grade ?? '?');
        }
      }
      const sizes = new Set(past.map((p) => p.results.length));
      expect(sizes.size, `${classId} keeps one class size`).toBeLessThanOrEqual(1);
    }
  });
});

describe('get_scores room scope', () => {
  it('a taught room returns the latest scores plus its history', async () => {
    const r = await getScores({ classLabel: 'ม.2/1' });
    expect(r).toMatchObject({ hasData: true, classId: 'class-m2-1', label: 'ม.2/1', n: 8 });
    expect(r.history.map((h: { date: string }) => h.date)).toEqual([
      '2026-09-08',
      '2026-10-13',
      '2026-11-12',
    ]);
    expect(r.history.at(-1)).toMatchObject({ mean: r.mean, indicator: 'ค 2.2 ม.2/5' });
    expect(r.repeatedlyBelowThreshold).toEqual([
      { studentId: 's-08', displayName: 'นักเรียนตัวอย่าง 08', times: 3 },
      { studentId: 's-04', displayName: 'นักเรียนตัวอย่าง 04', times: 2 },
    ]);
  });

  it('ป.5/2 keeps its latest numbers and gains three history entries', async () => {
    const r = await getScores({ classLabel: 'ป.5/2' });
    expect(r).toMatchObject({ n: 20, mean: 6.8 });
    expect(r.history).toHaveLength(3);
  });

  it.each([untaughtDemoClass.label, untaughtDemoClass.id, 'ม 2/3'])(
    'a room the teacher does not teach is refused even when it has data (%s)',
    async (classLabel) => {
      await expect(getScores({ classLabel })).rejects.toMatchObject({ code: 'class_not_taught' });
    },
  );

  it('another owner cannot read the demo teacher’s rooms', async () => {
    await expect(
      getScores({ classLabel: 'ป.5/2' }, ctx({ ownerId: 'teacher-other' })),
    ).rejects.toMatchObject({ code: 'class_not_taught' });
  });

  it('a session room outside the teacher’s list is refused', async () => {
    await expect(getScores({}, ctx({ classId: untaughtDemoClass.id }))).rejects.toMatchObject({
      code: 'class_not_taught',
    });
  });

  it('a taught room without scores says it is empty', async () => {
    expect(await getScores({ classLabel: 'ม.2/2' })).toEqual({
      hasData: false,
      classId: 'class-m2-2',
      label: 'ม.2/2',
      message: 'ยังไม่มีข้อมูลคะแนนของห้องนี้',
    });
  });
});
