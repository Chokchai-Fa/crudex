import { sampleClassM21 } from '@repo/shared';
import { expect, it } from 'vitest';
import { summarizeScores } from '../src/repositories/score-history';

it('reports the latest assessment separately and counts repeated difficulties', () => {
  const rows = sampleClassM21.assessments.flatMap((a) =>
    a.results.map((result, i) => ({
      assessmentId: a.date,
      date: a.date,
      studentId: 's-' + i,
      score: [...result].filter((c) => c === '1').length,
      answers: Object.fromEntries([...result].map((c, j) => [String(j), c])),
      content: {
        grade: 'ม.2',
        title: a.title,
        topic: a.topic,
        questions: a.questionTopics.map((topic, j) => ({
          id: String(j),
          text: topic,
          topic,
          choices: [],
          correctChoiceId: '1',
        })),
      },
    })),
  );
  const result = summarizeScores('room', 'ม.2/1', rows);
  expect(result.history).toHaveLength(3);
  expect(result).toMatchObject({
    meanLabel: '3.5/6 คะแนน',
    weakestTopic: { correctPercent: 37.5 },
    repeatedlyBelowThreshold: [
      { studentId: 's-7', times: 3 },
      { studentId: 's-3', times: 2 },
    ],
  });
  expect(summarizeScores('empty', '', []).hasData).toBe(false);
});
