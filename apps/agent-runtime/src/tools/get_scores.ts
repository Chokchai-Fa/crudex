import { assessment, questionTopics, results } from '../data/sample';
import { identityOf } from './identity';
import type { ToolDefinition } from './types';

const threshold = assessment.maxScore * 0.5;

const students = results.map((row, i) => {
  const wrong = new Map<string, { wrong: number; total: number }>();
  [...row].forEach((c, q) => {
    const topic = questionTopics[q] as string;
    const t = wrong.get(topic) ?? { wrong: 0, total: 0 };
    t.total++;
    if (c === 'x') t.wrong++;
    wrong.set(topic, t);
  });
  const no = String(i + 1).padStart(2, '0');
  return {
    studentId: 's-' + no,
    displayName: 'นักเรียนตัวอย่าง ' + no,
    score: [...row].filter((c) => c === '1').length,
    wrongTopics: [...wrong].filter(([, v]) => v.wrong > 0).map(([topic, v]) => ({ topic, ...v })),
  };
});

export function summarize() {
  const byTopic = new Map<string, { wrong: number; total: number }>();
  for (const row of results) {
    [...row].forEach((c, q) => {
      const topic = questionTopics[q] as string;
      const t = byTopic.get(topic) ?? { wrong: 0, total: 0 };
      t.total++;
      if (c === 'x') t.wrong++;
      byTopic.set(topic, t);
    });
  }
  const total = students.reduce((sum, s) => sum + s.score, 0);
  return {
    ...assessment,
    threshold,
    n: students.length,
    mean: Math.round((total / students.length) * 100) / 100,
    wrongByTopic: [...byTopic]
      .map(([topic, v]) => ({ topic, ...v, wrongRate: Math.round((v.wrong / v.total) * 1000) / 1000 }))
      .sort((a, b) => b.wrongRate - a.wrongRate),
    belowThreshold: students.filter((s) => s.score < threshold).map(({ studentId, displayName, score }) => ({ studentId, displayName, score })),
    students,
  };
}

export const getScores: ToolDefinition = {
  name: 'get_scores',
  description:
    'ดูคะแนนตัวอย่างของห้องที่ครูสอน (ห้องมาจาก session ไม่ต้องระบุ) คืนค่าเฉลี่ย รายชื่อต่ำกว่าเกณฑ์ (ต่ำกว่า 50% ของคะแนนเต็ม ระบบตั้ง) หัวข้อที่ผิดมากสุด และรายคน ตัวเลขทุกตัวคำนวณโดยระบบ',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: (_input, context) => ({ classId: identityOf(context).classId, ...summarize() }),
};
