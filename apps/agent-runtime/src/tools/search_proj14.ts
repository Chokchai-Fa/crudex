import { z } from 'zod';
import { nonBlank, validatedTool } from './validated';

export const searchProj14 = validatedTool(z.strictObject({ topic: nonBlank }), {
  name: 'search_proj14',
  description: 'ค้นสื่อ/คลิปตามหัวข้อ Project 14 (ตัวจำลอง: ข้อมูลตัวอย่าง ไม่มีลิงก์จริง)',
  gate: 'allow',
  execute: ({ topic }) => {
    return {
      mode: 'mock',
      topic,
      items: [
        {
          title: 'ตัวอย่าง: คลิปสอนบวกเศษส่วนต่างตัวส่วน',
          url: null,
          note: 'ยังไม่ได้เชื่อมแหล่ง Project 14',
        },
      ],
    };
  },
});
