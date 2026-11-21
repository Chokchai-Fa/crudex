import { z } from 'zod';
import { nonBlank, validatedTool } from './validated';

export const makeSheet = validatedTool(z.strictObject({ title: nonBlank, topic: nonBlank }), {
  name: 'make_sheet',
  description: 'สร้างชีตสรุป/ชีตเรียน (ตัวจำลอง: คืนรหัสไฟล์ตัวอย่าง ยังไม่ได้สร้างไฟล์จริง)',
  gate: 'allow',
  execute: (input) => ({
    mode: 'mock',
    fileId: 'sheet-' + crypto.randomUUID().slice(0, 8),
    note: 'ตัวอย่าง: ยังไม่ได้สร้างไฟล์จริง',
    request: input,
  }),
});
