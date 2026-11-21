// All data here is invented sample data (ตัวอย่าง). No real student, school or budget figures.
export const sampleOwner = 'teacher-demo';
export const sampleClassId = 'class-p5-2';

const addSub = 'การบวก การลบของเศษส่วนและจำนวนคละ';
const compare = 'การเปรียบเทียบเศษส่วนและจำนวนคละ';
const word = 'การแก้โจทย์ปัญหาเศษส่วนและจำนวนคละ';
export const questionTopics = [addSub, addSub, addSub, addSub, addSub, addSub, compare, compare, word, word] as const;

// One row per student, one char per question: '1' correct, 'x' wrong.
export const results = [
  '1111xx111x',
  '11x1111111',
  'xxxx11xxx1',
  'xxxx11111x',
  'xx1xx111x1',
  '111111111x',
  'xx11x111x1',
  '1xx1111111',
  '1x1x1x1111',
  '1x11111111',
  'x1111xx111',
  'xxx11xx11x',
  '11x111111x',
  '111111x1x1',
  '11111xx1x1',
  '11x111x111',
  '111111x11x',
  '11111x1111',
  'xxxxxx1x1x',
  'x11xx11111'
] as const;

export const assessment = { assessmentId: 'a-001', title: 'ตัวอย่าง: ใบงานเศษส่วน ป.5', topic: 'เศษส่วน', maxScore: 10 } as const;

export const budgetSheet = {
  title: 'ตัวอย่าง: ชีตงบกลุ่มสาระคณิตศาสตร์ ปีงบประมาณ 2569',
  unit: 'บาท',
  lines: [
    { code: 'M-01', item: 'กระดาษ A4', budget: 6000, spent: 2400 },
    { code: 'M-02', item: 'อุปกรณ์การสอน', budget: 9000, spent: 3100 },
    { code: 'M-03', item: 'ค่าพิมพ์เอกสาร', budget: 5000, spent: 1500 },
  ],
} as const;
