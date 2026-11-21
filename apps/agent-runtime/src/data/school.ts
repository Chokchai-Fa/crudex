import { classHistories } from './class-history';
export const principalOwner = 'principal-demo';

// Invented sample data (ตัวอย่าง). Class-level aggregates only: nothing here identifies a student.
const fixedClasses = [
  { classId: 'class-p5-1', label: 'ป.5/1', subject: 'คณิตศาสตร์', n: 22, mean: 7.4, maxScore: 10 },
  { classId: 'class-p6-1', label: 'ป.6/1', subject: 'คณิตศาสตร์', n: 24, mean: 6.1, maxScore: 10 },
] as const;

export interface SchoolClass {
  classId: string;
  label: string;
  subject: string;
  n: number;
  mean: number;
  maxScore: number;
  /** Class-level correct rate per topic of the latest assessment; no student rows. */
  topics?: { topic: string; correct: number; total: number; correctRate: number }[];
}

/** Latest sample assessment of a teacher-side room, reduced to class-level numbers only. */
function aggregate(classId: string, label: string): SchoolClass[] {
  const history = classHistories[classId];
  if (!history) return [];
  const scores = history.results.map((row) => [...row].filter((answer) => answer === '1').length);
  const mean = Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100;
  const byTopic = new Map<string, { correct: number; total: number }>();
  for (const row of history.results) {
    [...row].forEach((answer, index) => {
      const topic = history.questionTopics[index] as string;
      const count = byTopic.get(topic) ?? { correct: 0, total: 0 };
      count.total++;
      if (answer === '1') count.correct++;
      byTopic.set(topic, count);
    });
  }
  return [
    {
      classId,
      label,
      subject: 'คณิตศาสตร์',
      n: scores.length,
      mean,
      maxScore: history.assessment.maxScore,
      topics: [...byTopic].map(([topic, v]) => ({
        topic,
        ...v,
        correctRate: Math.round((v.correct / v.total) * 1000) / 1000,
      })),
    },
  ];
}

// Teacher-side rooms (class-history.ts) also appear on the principal side, computed from the same sample rows.
export const schoolClasses: readonly SchoolClass[] = [
  ...fixedClasses,
  ...aggregate('class-p5-2', 'ป.5/2'),
  ...aggregate('class-m2-1', 'ม.2/1'),
]
  .filter((c, i, all) => all.findIndex((o) => o.classId === c.classId) === i)
  .sort((a, b) => a.label.localeCompare(b.label, 'th'));

export const activities = [
  { code: 'A24', name: 'กิจกรรมค่ายคณิตศาสตร์', budget: 30000, spent: 27500 },
  { code: 'A11', name: 'วันวิทยาศาสตร์', budget: 20000, spent: 6000 },
  { code: 'A07', name: 'ห้องสมุดเคลื่อนที่', budget: 15000, spent: 14200 },
] as const;

export const teacherActivityLog = [
  { teacher: 'ครูตัวอย่าง ก', date: 'เมื่อวาน', action: 'สร้างใบงาน', count: 2 },
  { teacher: 'ครูตัวอย่าง ก', date: 'เมื่อวาน', action: 'สร้างแบบทดสอบ Google Form', count: 1 },
] as const;

/** Short topic names for one brief line; the curriculum name stays in the data. */
export const briefTopicNames: Readonly<Record<string, string>> = {
  การนำความรู้เกี่ยวกับทฤษฎีบทพีทาโกรัสและบทกลับไปใช้ในชีวิตจริง: 'การนำพีทาโกรัสไปใช้ในชีวิตจริง',
};
