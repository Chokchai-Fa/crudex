import { z } from 'zod';
import { validatedTool } from './validated';

const sample = [
  {
    exam: 'O-NET',
    topic: 'เศษส่วน',
    style: 'ปรนัย 4 ตัวเลือก โจทย์ปัญหา 2 ขั้นตอน',
    note: 'ตัวอย่างแนวข้อสอบเท่านั้น ไม่ใช่ข้อสอบจริง',
  },
  {
    exam: 'TGAT',
    topic: 'การคิดเชิงเหตุผล',
    style: 'อ่านข้อมูลแล้วสรุป',
    note: 'ตัวอย่างแนวข้อสอบเท่านั้น ไม่ใช่ข้อสอบจริง',
  },
];

export const oldExamSearch = validatedTool(
  z.strictObject({
    exam: z.enum(['O-NET', 'TGAT', 'TPAT']),
    topic: z.string().optional(),
    limit: z.int().min(1).max(5).optional(),
  }),
  {
    name: 'old_exam_search',
    description:
      'ค้น "แนว" ข้อสอบเก่า (O-NET, TGAT, TPAT) เพื่อดูรูปแบบ ไม่คืนตัวข้อสอบจริง ห้ามคัดลอกทั้งข้อ (ตัวจำลอง: ข้อมูลตัวอย่าง)',
    gate: 'allow',
    execute: ({ exam, topic, limit }) => {
      const items = sample
        .filter((s) => s.exam === exam && (topic ? s.topic.includes(topic) : true))
        .slice(0, limit ?? 3);
      return { mode: 'mock', items, note: 'ยังไม่ได้เชื่อมคลังข้อสอบเก่าที่ใช้ได้ตามลิขสิทธิ์' };
    },
  },
);
