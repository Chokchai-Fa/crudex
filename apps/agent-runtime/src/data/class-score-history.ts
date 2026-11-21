// ข้อมูลตัวอย่างทั้งหมด (ตัวอย่าง): ห้อง นักเรียน และคะแนนแต่งขึ้นเพื่อเดโม ไม่ใช่ข้อมูลนักเรียนจริง
// Each row is one student (same order as studentIdentity), one char per question: '1' correct, 'x' wrong.
// Topic names are copied from the curriculum topic lists (indicators.ts / indicators-m2.ts).
import { classHistories, type ClassHistory } from './class-history';

export interface PastAssessment extends ClassHistory {
  /** ISO date the sample assessment was given. */
  date: string;
}

/** A demo room the sample teacher does not teach. It has data so tests can prove the scope check rejects it. */
export const untaughtDemoClass = { id: 'class-m2-3', label: 'ม.2/3' } as const;

const latest = (classId: string, date: string): PastAssessment[] => {
  const history = classHistories[classId];
  return history ? [{ ...history, date }] : [];
};

// ป.5/2 ----------------------------------------------------------------
const p5Compare = 'การเปรียบเทียบเศษส่วนและจำนวนคละ';
const p5AddSub = 'การบวก การลบของเศษส่วนและจำนวนคละ';
const p5MulDiv = 'การคูณ การหารของเศษส่วนและจำนวนคละ';
const p5Word = 'การแก้โจทย์ปัญหาเศษส่วนและจำนวนคละ';

// ม.2 ------------------------------------------------------------------
const m2Irrational = 'จำนวนอตรรกยะ';
const m2Roots = 'รากที่สองและรากที่สามของจำนวนตรรกยะ';
const m2RealUse = 'การนำความรู้เกี่ยวกับจำนวนจริงไปใช้';
const m2Surface = 'การหาพื้นที่ผิวของปริซึมและทรงกระบอก';
const m2Volume = 'การหาปริมาตรของปริซึมและทรงกระบอก';

/** Oldest first. The last item of each taught room is the same assessment get_scores already returns. */
export const pastAssessments: Readonly<Record<string, readonly PastAssessment[]>> = {
  'class-p5-2': [
    {
      date: '2026-09-15',
      assessment: {
        assessmentId: 'demo-p5-2-fraction-compare',
        title: 'ตัวอย่าง: ใบงานเปรียบเทียบและบวกลบเศษส่วน ป.5/2',
        topic: p5Compare,
        indicator: 'ค 1.1 ป.5/3',
        maxScore: 10,
      },
      questionTopics: [
        p5Compare,
        p5Compare,
        p5Compare,
        p5Compare,
        p5AddSub,
        p5AddSub,
        p5AddSub,
        p5AddSub,
        p5AddSub,
        p5AddSub,
      ],
      results: [
        '11111xx111',
        '1111x111xx',
        'x11111x11x',
        '1x111111x1',
        '11xxxx1x11',
        '11xx1111x1',
        '111x111x1x',
        '11111x1111',
        '1111xxxx1x',
        'x1x111x11x',
        '1111111111',
        'xx111x1x11',
        '11x111x111',
        '111x11xx11',
        '1xx111111x',
        '111111111x',
        '111xxx111x',
        '11111111x1',
        '11x1x1xx1x',
        '1111x11x11',
      ],
    },
    {
      date: '2026-10-20',
      assessment: {
        assessmentId: 'demo-p5-2-fraction-muldiv',
        title: 'ตัวอย่าง: แบบทดสอบคูณหารเศษส่วน ป.5/2',
        topic: p5MulDiv,
        indicator: 'ค 1.1 ป.5/4',
        maxScore: 10,
      },
      questionTopics: [
        p5MulDiv,
        p5MulDiv,
        p5MulDiv,
        p5MulDiv,
        p5MulDiv,
        p5MulDiv,
        p5Word,
        p5Word,
        p5Word,
        p5Word,
      ],
      results: [
        '1xx111xxx1',
        '11111xxxx1',
        '111x11xxxx',
        '1x1x111x1x',
        'xxx11111x1',
        '1xx11xx11x',
        '11x11x1x1x',
        '11x1111111',
        '1x1xxx1x1x',
        'x11111xx11',
        'xx1111x1xx',
        'xx111xxx11',
        'x111x1111x',
        'x11111111x',
        '1111x1xxxx',
        '1x1111x1xx',
        '1xxx11xxxx',
        'x1xxx11xxx',
        '11x1x1xxxx',
        'x11111x111',
      ],
    },
    ...latest('class-p5-2', '2026-11-10'),
  ],
  'class-m2-1': [
    {
      date: '2026-09-08',
      assessment: {
        assessmentId: 'demo-m2-1-real-numbers',
        title: 'ตัวอย่าง: แบบฝึกหัดจำนวนจริง ม.2/1',
        topic: m2Irrational,
        indicator: 'ค 1.1 ม.2/2',
        maxScore: 6,
      },
      questionTopics: [m2Irrational, m2Irrational, m2Roots, m2RealUse, m2RealUse, m2RealUse],
      results: ['111x11', 'x1xx11', '11xxx1', '1111xx', '1x1xxx', 'x111xx', '1x11xx', 'x1xxxx'],
    },
    {
      date: '2026-10-13',
      assessment: {
        assessmentId: 'demo-m2-1-prism-cylinder',
        title: 'ตัวอย่าง: แบบทดสอบปริซึมและทรงกระบอก ม.2/1',
        topic: m2Surface,
        indicator: 'ค 2.1 ม.2/1',
        maxScore: 6,
      },
      questionTopics: [m2Surface, m2Surface, m2Surface, m2Volume, m2Volume, m2Volume],
      results: ['111xxx', '11xxx1', 'xx11x1', 'x1xx1x', '1x1x1x', '1111x1', '1x11xx', '1xxx1x'],
    },
    ...latest('class-m2-1', '2026-11-12'),
  ],
  'class-m2-2': [],
  [untaughtDemoClass.id]: [
    {
      date: '2026-11-05',
      assessment: {
        assessmentId: 'demo-m2-3-real-numbers',
        title: 'ตัวอย่าง: แบบฝึกหัดจำนวนจริง ม.2/3',
        topic: m2Irrational,
        indicator: 'ค 1.1 ม.2/2',
        maxScore: 6,
      },
      questionTopics: [m2Irrational, m2Irrational, m2Roots, m2RealUse, m2RealUse, m2RealUse],
      results: ['11x111', '1x1111', '11111x', '111111', '1x1111', '1x1111'],
    },
  ],
};
