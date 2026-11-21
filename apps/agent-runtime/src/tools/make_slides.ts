import type { ToolDefinition } from './types';

export const makeSlides: ToolDefinition = {
  name: 'make_slides',
  description: 'สร้างสไลด์ตามโครงที่ระบุ (ตัวจำลอง: คืนรหัสไฟล์ตัวอย่าง ยังไม่ได้สร้างไฟล์จริง)',
  input: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      outline: { type: 'array', items: { type: 'string' }, minItems: 1 },
    },
    required: ['title', 'outline'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => ({
    mode: 'mock',
    fileId: 'slides-' + crypto.randomUUID().slice(0, 8),
    note: 'ตัวอย่าง: ยังไม่ได้สร้างไฟล์จริง',
    request: input,
  }),
};
