// ข้อมูลตัวอย่างทั้งหมด (ตัวอย่าง): ห้อง ม.2/1 ของเดโม นักเรียนและคะแนนแต่งขึ้น ไม่ใช่ข้อมูลจริง
// Same rows as agent-runtime pastAssessments['class-m2-1'] (checked by agent-runtime/test/demo-story.test.ts).
// Each row is one student in order, one char per question: '1' correct, 'x' wrong.

const irrational = 'จำนวนอตรรกยะ';
const roots = 'รากที่สองและรากที่สามของจำนวนตรรกยะ';
const realUse = 'การนำความรู้เกี่ยวกับจำนวนจริงไปใช้';
const surface = 'การหาพื้นที่ผิวของปริซึมและทรงกระบอก';
const volume = 'การหาปริมาตรของปริซึมและทรงกระบอก';
const theorem = 'ทฤษฎีบทพีทาโกรัสและบทกลับ';
const application = 'การนำความรู้เกี่ยวกับทฤษฎีบทพีทาโกรัสและบทกลับไปใช้ในชีวิตจริง';

export const sampleClassM21 = {
  label: 'ม.2/1',
  grade: 'ม.2',
  studentNames: Array.from(
    { length: 8 },
    (_, i) => `นักเรียนตัวอย่าง ${String(i + 1).padStart(2, '0')}`,
  ),
  assessments: [
    {
      date: '2026-09-08',
      title: 'ตัวอย่าง: แบบฝึกหัดจำนวนจริง ม.2/1',
      topic: irrational,
      indicator: 'ค 1.1 ม.2/2',
      questionTopics: [irrational, irrational, roots, realUse, realUse, realUse],
      results: ['111x11', 'x1xx11', '11xxx1', '1111xx', '1x1xxx', 'x111xx', '1x11xx', 'x1xxxx'],
    },
    {
      date: '2026-10-13',
      title: 'ตัวอย่าง: แบบทดสอบปริซึมและทรงกระบอก ม.2/1',
      topic: surface,
      indicator: 'ค 2.1 ม.2/1',
      questionTopics: [surface, surface, surface, volume, volume, volume],
      results: ['111xxx', '11xxx1', 'xx11x1', 'x1xx1x', '1x1x1x', '1111x1', '1x11xx', '1xxx1x'],
    },
    {
      date: '2026-11-12',
      title: 'ตัวอย่าง: แบบฝึกหัดพีทาโกรัส ม.2/1',
      topic: theorem,
      indicator: 'ค 2.2 ม.2/5',
      questionTopics: [theorem, theorem, theorem, application, application, application],
      results: ['1111xx', '11xxx1', '11111x', '1x1xxx', 'x11xx1', '111x1x', '111111', 'x1xxxx'],
    },
  ],
} as const;
