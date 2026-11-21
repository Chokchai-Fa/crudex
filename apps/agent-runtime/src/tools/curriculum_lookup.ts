import { z } from 'zod';
import { indicators, topics } from '../data/indicators';
import { validatedTool } from './validated';

export const curriculumLookup = validatedTool(
  z.strictObject({
    grade: z.string().optional(),
    query: z.string().optional(),
    id: z.string().optional(),
  }),
  {
    name: 'curriculum_lookup',
    description:
      'ค้นตัวชี้วัดคณิตศาสตร์ของหลักสูตรแกนกลาง (ชุดที่มี: ป.5 สาระ ค 1.1, ค 2.1, ค 3.1) ใช้ id ตามที่คืนมาเท่านั้น ห้ามแต่งรหัสตัวชี้วัด' +
      ' คืน topics (ชื่อหัวข้อย่อยมาตรฐาน) ให้ใช้เป็นค่า topic ของข้อสอบตรงตัว',
    gate: 'allow',
    execute: ({ grade, query, id }) => {
      const inGrade = indicators.filter(
        (i) => (grade ? i.grade === grade : true) && (id ? i.id === id : true),
      );
      const words = (query ?? '').split(/\s+/).filter(Boolean);
      const byQuery = words.length
        ? inGrade.filter((i) => words.some((word) => i.text.includes(word)))
        : inGrade;
      const fellBack =
        words.length > 0 && byQuery.length === 0 && inGrade.length > 0 && grade !== undefined;
      const items = (fellBack ? inGrade : byQuery).slice(0, 20);
      const matched = new Set(items.map((i) => i.id));
      return {
        count: items.length,
        items,
        topics: topics.filter((t) => matched.has(t.indicator)),
        note: fellBack
          ? 'ไม่พบตัวชี้วัดที่ตรงคำค้น จึงคืนทั้งชั้น เลือกเฉพาะข้อที่ตรงกับหัวข้อ'
          : items.length === 0
            ? 'ไม่พบตัวชี้วัดในชุดที่มี ห้ามแต่งรหัสเอง'
            : undefined,
      };
    },
  },
);
