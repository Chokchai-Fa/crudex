import { indicators, topics } from '../data/indicators';
import type { ToolDefinition } from './types';

export const curriculumLookup: ToolDefinition = {
  name: 'curriculum_lookup',
  description:
    'ค้นตัวชี้วัดคณิตศาสตร์ของหลักสูตรแกนกลาง (ชุดที่มี: ป.5 สาระ ค 1.1, ค 2.1, ค 3.1) ใช้ id ตามที่คืนมาเท่านั้น ห้ามแต่งรหัสตัวชี้วัด' + ' คืน topics (ชื่อหัวข้อย่อยมาตรฐาน) ให้ใช้เป็นค่า topic ของข้อสอบตรงตัว',
  input: {
    type: 'object',
    properties: { grade: { type: 'string' }, query: { type: 'string' }, id: { type: 'string' } },
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => {
    const { grade, query, id } = input as { grade?: string; query?: string; id?: string };
    const items = indicators
      .filter((i) => (grade ? i.grade === grade : true) && (id ? i.id === id : true) && (query ? i.text.includes(query) : true))
      .slice(0, 20);
    const matched = new Set(items.map((i) => i.id));
    return { count: items.length, items, topics: topics.filter((t) => matched.has(t.indicator)), note: items.length === 0 ? 'ไม่พบตัวชี้วัดในชุดที่มี ห้ามแต่งรหัสเอง' : undefined };
  },
};
