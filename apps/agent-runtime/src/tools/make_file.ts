import { z } from 'zod';
import { nonBlank, validatedTool } from './validated';

export const makeFile = validatedTool(
  z.strictObject({ title: nonBlank, format: z.enum(['pdf', 'docx']) }),
  {
    name: 'make_file',
    description:
      'ออกใบงานเป็นไฟล์ A4 (PDF/DOCX) จากชุดที่ผ่านการตรวจ (ตัวจำลอง: คืนรหัสไฟล์ตัวอย่าง ยังไม่ได้สร้างไฟล์จริง)',
    gate: 'allow',
    execute: (input) => ({
      mode: 'mock',
      fileId: 'file-' + crypto.randomUUID().slice(0, 8),
      note: 'ตัวอย่าง: ยังไม่ได้สร้างไฟล์จริง',
      request: input,
    }),
  },
);
