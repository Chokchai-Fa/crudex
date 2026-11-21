import { z } from 'zod';
import { classHistories, studentIdentity, type ClassHistory } from '../data/class-history';
import { classesOf } from '../data/accounts';
import { pastAssessments, type PastAssessment } from '../data/class-score-history';
import { classOf, ownerOf, ToolError } from './identity';
import { validatedTool } from './validated';

function countTopics(
  row: string,
  questionTopics: ClassHistory['questionTopics'],
  counts = new Map<string, { wrong: number; total: number }>(),
) {
  [...row].forEach((answer, index) => {
    const topic = questionTopics[index] as string;
    const count = counts.get(topic) ?? { wrong: 0, total: 0 };
    count.total++;
    if (answer === 'x') count.wrong++;
    counts.set(topic, count);
  });
  return counts;
}

function summarize({ assessment, questionTopics, results }: ClassHistory) {
  const threshold = assessment.maxScore * 0.5;
  const byTopic = new Map<string, { wrong: number; total: number }>();
  const students = results.map((row, index) => {
    countTopics(row, questionTopics, byTopic);
    const wrong = countTopics(row, questionTopics);
    return {
      ...studentIdentity(index),
      score: [...row].filter((answer) => answer === '1').length,
      wrongTopics: [...wrong].filter(([, v]) => v.wrong > 0).map(([topic, v]) => ({ topic, ...v })),
    };
  });
  const total = students.reduce((sum, s) => sum + s.score, 0);
  return {
    ...assessment,
    threshold,
    n: students.length,
    mean: Math.round((total / students.length) * 100) / 100,
    wrongByTopic: [...byTopic]
      .map(([topic, v]) => ({
        topic,
        ...v,
        wrongRate: Math.round((v.wrong / v.total) * 1000) / 1000,
      }))
      .sort((a, b) => b.wrongRate - a.wrongRate),
    belowThreshold: students
      .filter((s) => s.score < threshold)
      .map(({ studentId, displayName, score }) => ({ studentId, displayName, score })),
    students,
  };
}

/** Short summary of every past assessment (oldest first) and students below threshold in two or more. */
function historyOf(classId: string) {
  const past: readonly PastAssessment[] = pastAssessments[classId] ?? [];
  const below = new Map<string, { studentId: string; displayName: string; times: number }>();
  const history = past.map((item) => {
    const s = summarize(item);
    for (const { studentId, displayName } of s.belowThreshold) {
      const entry = below.get(studentId) ?? { studentId, displayName, times: 0 };
      entry.times++;
      below.set(studentId, entry);
    }
    return {
      assessmentId: s.assessmentId,
      date: item.date,
      title: s.title,
      topic: s.topic,
      indicator: s.indicator,
      maxScore: s.maxScore,
      n: s.n,
      mean: s.mean,
      belowThresholdCount: s.belowThreshold.length,
      wrongByTopic: s.wrongByTopic,
    };
  });
  return {
    history,
    repeatedlyBelowThreshold: [...below.values()]
      .filter((s) => s.times >= 2)
      .sort((a, b) => b.times - a.times || a.studentId.localeCompare(b.studentId)),
  };
}

function normalizeLabel(label: string) {
  return label
    .trim()
    .replace(/\s+/gu, '')
    .replace(/^([มป])\.?/u, '$1.');
}

export const getScores = validatedTool(z.strictObject({ classLabel: z.string().optional() }), {
  name: 'get_scores',
  description:
    'ดูคะแนนตัวอย่างของห้องที่ครูสอน ระบุ classLabel เป็นชื่อห้อง เช่น ม.2/1 หรือรหัสห้องได้ ถ้าไม่ระบุจะใช้ห้องในเซสชันหรือห้องแรกที่ครูสอน คืนค่าเฉลี่ย รายชื่อต่ำกว่าเกณฑ์ (ต่ำกว่า 50% ของคะแนนเต็ม ระบบตั้ง) หัวข้อที่ผิดมากสุด และคะแนนรายคนของครั้งล่าสุด พร้อม history สรุปทุกครั้งที่ผ่านมา (เก่าไปใหม่) และ repeatedlyBelowThreshold นักเรียนที่ต่ำกว่าเกณฑ์ตั้งแต่ 2 ครั้ง ตัวเลขทุกตัวคำนวณโดยระบบ',
  gate: 'allow',
  execute: ({ classLabel }, context) => {
    const ownerId = ownerOf(context).id;
    const rooms = classesOf(ownerId);
    const sessionClassId = classOf(context);
    const room =
      classLabel !== undefined
        ? rooms.find(
            ({ id, label }) =>
              id === classLabel.trim() || normalizeLabel(label) === normalizeLabel(classLabel),
          )
        : sessionClassId === undefined
          ? rooms[0]
          : rooms.find(({ id }) => id === sessionClassId);
    if (!room) {
      const labels = rooms.map(({ label }) => label).join(', ');
      throw new ToolError(
        'class_not_taught',
        labels ? `เลือกได้เฉพาะห้องที่ครูสอน ได้แก่ ${labels}` : 'ยังไม่มีห้องที่ครูสอนในระบบ',
      );
    }

    const { id: classId, label } = room;
    const history = classHistories[classId];
    if (!history) {
      return { hasData: false, classId, label, message: 'ยังไม่มีข้อมูลคะแนนของห้องนี้' };
    }
    return { hasData: true, classId, label, ...summarize(history), ...historyOf(classId) };
  },
});
