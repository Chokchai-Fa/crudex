import type { ToolDefinition } from './types';

export const searchProj14: ToolDefinition = {
  name: 'search_proj14',
  description: 'ค้นสื่อ/คลิปตามหัวข้อ Project 14 (ตัวจำลอง: ข้อมูลตัวอย่าง ไม่มีลิงก์จริง)',
  input: {
    type: 'object',
    properties: { topic: { type: 'string' } },
    required: ['topic'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => {
    const { topic } = input as { topic: string };
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
};
