import type { ToolDefinition } from './types';

export const makeSheet: ToolDefinition = {
  name: 'make_sheet',
  description: 'สร้างชีตสรุป/ชีตเรียน (ตัวจำลอง: คืนรหัสไฟล์ตัวอย่าง ยังไม่ได้สร้างไฟล์จริง)',
  input: {
    type: 'object',
    properties: { title: { type: 'string' }, topic: { type: 'string' } },
    required: ['title', 'topic'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input) => ({
    mode: 'mock',
    fileId: 'sheet-' + crypto.randomUUID().slice(0, 8),
    note: 'ตัวอย่าง: ยังไม่ได้สร้างไฟล์จริง',
    request: input,
  }),
};
