import { classHistories } from './class-history';
export const principalOwner = 'principal-demo';

// Invented sample data (ตัวอย่าง). Class-level aggregates only: nothing here identifies a student.
const fixedClasses = [
  { classId: 'class-p5-1', label: 'ป.5/1', subject: 'คณิตศาสตร์', n: 22, mean: 7.4, maxScore: 10 },
  { classId: 'class-p5-2', label: 'ป.5/2', subject: 'คณิตศาสตร์', n: 20, mean: 6.8, maxScore: 10 },
  { classId: 'class-p6-1', label: 'ป.6/1', subject: 'คณิตศาสตร์', n: 24, mean: 4.6, maxScore: 10 },
] as const;

/** Latest sample assessment of a teacher-side room, reduced to class-level numbers only. */
function aggregate(classId: string, label: string) {
  const history = classHistories[classId];
  if (!history) return [];
  const scores = history.results.map((row) => [...row].filter((answer) => answer === '1').length);
  const mean = Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100;
  return [
    {
      classId,
      label,
      subject: 'คณิตศาสตร์',
      n: scores.length,
      mean,
      maxScore: history.assessment.maxScore,
    },
  ];
}

// Teacher-side rooms (class-history.ts) also appear on the principal side, computed from the same sample rows.
export const schoolClasses: readonly {
  classId: string;
  label: string;
  subject: string;
  n: number;
  mean: number;
  maxScore: number;
}[] = [...fixedClasses, ...aggregate('class-m2-1', 'ม.2/1')];

export const activities = [
  { code: 'A24', name: 'กิจกรรมค่ายคณิตศาสตร์', budget: 30000, spent: 27500 },
  { code: 'A11', name: 'วันวิทยาศาสตร์', budget: 20000, spent: 6000 },
  { code: 'A07', name: 'ห้องสมุดเคลื่อนที่', budget: 15000, spent: 14200 },
] as const;

export const teacherActivityLog = [
  { teacher: 'ครูตัวอย่าง ก', date: 'เมื่อวาน', action: 'สร้างใบงาน', count: 2 },
  { teacher: 'ครูตัวอย่าง ก', date: 'เมื่อวาน', action: 'สร้างแบบทดสอบ Google Form', count: 1 },
] as const;
