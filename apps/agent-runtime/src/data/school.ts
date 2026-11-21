export const principalOwner = 'principal-demo';

// Invented sample data (ตัวอย่าง). Class-level aggregates only: nothing here identifies a student.
export const schoolClasses = [
  { classId: 'class-p5-1', label: 'ป.5/1', subject: 'คณิตศาสตร์', n: 22, mean: 7.4, maxScore: 10 },
  { classId: 'class-p5-2', label: 'ป.5/2', subject: 'คณิตศาสตร์', n: 20, mean: 6.8, maxScore: 10 },
  { classId: 'class-p6-1', label: 'ป.6/1', subject: 'คณิตศาสตร์', n: 24, mean: 4.6, maxScore: 10 },
] as const;

export const activities = [
  { code: 'A24', name: 'กิจกรรมค่ายคณิตศาสตร์', budget: 30000, spent: 27500 },
  { code: 'A11', name: 'วันวิทยาศาสตร์', budget: 20000, spent: 6000 },
  { code: 'A07', name: 'ห้องสมุดเคลื่อนที่', budget: 15000, spent: 14200 },
] as const;

export const teacherActivityLog = [
  { teacher: 'ครูตัวอย่าง ก', date: 'เมื่อวาน', action: 'สร้างใบงาน', count: 2 },
  { teacher: 'ครูตัวอย่าง ก', date: 'เมื่อวาน', action: 'สร้างแบบทดสอบ Google Form', count: 1 },
  { teacher: 'ครูตัวอย่าง ข', date: 'เมื่อวาน', action: 'ส่งเอกสารเบิกเข้ากล่องอนุมัติ', count: 1 },
] as const;
