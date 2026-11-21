import { assessment, questionTopics, results, sampleClassId, sampleOwner } from './sample';

export interface ClassHistory {
  assessment: {
    assessmentId: string;
    title: string;
    topic: string;
    maxScore: number;
    indicator?: string;
  };
  questionTopics: readonly string[];
  results: readonly string[];
}

export const teacherClasses: Readonly<Record<string, readonly { id: string; label: string }[]>> = {
  [sampleOwner]: [
    { id: sampleClassId, label: 'ป.5/2' },
    { id: 'class-m2-1', label: 'ม.2/1' },
    { id: 'class-m2-2', label: 'ม.2/2' },
  ],
};

const theorem = 'ทฤษฎีบทพีทาโกรัสและบทกลับ';
const application = 'การนำความรู้เกี่ยวกับทฤษฎีบทพีทาโกรัสและบทกลับไปใช้ในชีวิตจริง';
const mathayomTopics = [theorem, theorem, theorem, application, application, application];

// Invented classroom results. Each position is one question: 1 = correct, x = incorrect.
export const classHistories: Readonly<Record<string, ClassHistory | undefined>> = {
  [sampleClassId]: { assessment, questionTopics, results },
  'class-m2-1': {
    assessment: {
      assessmentId: 'demo-m2-1-pythagoras',
      title: 'ตัวอย่าง: แบบฝึกหัดพีทาโกรัส ม.2/1',
      topic: theorem,
      indicator: 'ค 2.2 ม.2/5',
      maxScore: mathayomTopics.length,
    },
    questionTopics: mathayomTopics,
    results: ['1111xx', '11xxx1', '11111x', '1x1xxx', 'x11xx1', '111x1x', '111111', 'x1xxxx'],
  },
  'class-m2-2': undefined,
};

export function studentIdentity(index: number) {
  const no = String(index + 1).padStart(2, '0');
  return { studentId: 's-' + no, displayName: 'นักเรียนตัวอย่าง ' + no };
}
