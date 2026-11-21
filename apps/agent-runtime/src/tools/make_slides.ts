import { z } from 'zod';
import { nonBlank, validatedTool } from './validated';

export const makeSlides = validatedTool(
  z.strictObject({ title: nonBlank, outline: z.array(nonBlank).min(1) }),
  {
    name: 'make_slides',
    description: 'สร้างสไลด์ตามโครงที่ระบุ (ตัวจำลอง: คืนรหัสไฟล์ตัวอย่าง ยังไม่ได้สร้างไฟล์จริง)',
    gate: 'allow',
    execute: (input) => ({
      mode: 'mock',
      fileId: 'slides-' + crypto.randomUUID().slice(0, 8),
      note: 'ตัวอย่าง: ยังไม่ได้สร้างไฟล์จริง',
      request: input,
    }),
  },
);
