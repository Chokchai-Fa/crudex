import type { ToolDefinition } from './types';

const sample = [
  { exam: 'O-NET', topic: 'เศษส่วน', style: 'ปรนัย 4 ตัวเลือก โจทย์ปัญหา 2 ขั้นตอน', note: 'ตัวอย่างแนวข้อสอบเท่านั้น ไม่ใช่ข้อสอบจริง' },
  { exam: 'TGAT', topic: 'การคิดเชิงเหตุผล', style: 'อ่านข้อมูลแล้วสรุป', note: 'ตัวอย่างแนวข้อสอบเท่านั้น ไม่ใช่ข้อสอบจริง' },
];

export const oldExamSearch: ToolDefinition = {
  name: 'old_exam_search',
  description: 'ค้น "แนว" ข้อสอบเก่า (O-NET, TGAT, TPAT) เพื่อดูรูปแบบ ไม่คืนตัวข้อสอบจริง ห้ามคัดลอกทั้งข้อ (ตัวจำลอง: ข้อมูลตัวอย่าง)',
  input: {
    type: 'object',
    properties: { exam: { type: 'string', enum: ['O-NET', 'TGAT', 'TPAT'] }, topic: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 5 } },
    required: ['exam'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => {
    const { exam, topic, limit } = input as { exam: string; topic?: string; limit?: number };
    const items = sample.filter((s) => s.exam === exam && (topic ? s.topic.includes(topic) : true)).slice(0, limit ?? 3);
    return { mode: 'mock', items, note: 'ยังไม่ได้เชื่อมคลังข้อสอบเก่าที่ใช้ได้ตามลิขสิทธิ์' };
  },
};
