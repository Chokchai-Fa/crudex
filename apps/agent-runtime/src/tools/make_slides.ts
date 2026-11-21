import { z } from 'zod';
import { createBridgeFile } from '../lib/bridge-file';
import { nonBlank, validatedTool } from './validated';

const slideSchema = z.strictObject({
  title: nonBlank.max(200),
  bullets: z.array(nonBlank.max(500)).max(12).default([]),
});

export const makeSlides = validatedTool(
  z
    .strictObject({
      title: nonBlank.max(200),
      outline: z.array(nonBlank.max(200)).min(1).max(20).optional(),
      slides: z.array(slideSchema).min(1).max(20).optional(),
    })
    .refine(({ outline, slides }) => outline || slides, { path: ['slides'] }),
  {
    name: 'make_slides',
    description:
      'สร้างไฟล์ Google Slides จริง (1–20 หน้า) ใส่ slides เป็นรายการ {title, bullets} หรือ outline เป็นหัวข้อหน้า คืน url ของไฟล์ (ทุกคนที่มีลิงก์ดูได้) และ label ข้อมูลตัวอย่าง ส่งลิงก์ตาม url ที่คืนมาเท่านั้น ถ้าสร้างไม่สำเร็จให้บอกครูตรง ๆ ห้ามแต่งลิงก์',
    gate: 'allow',
    execute: async ({ title, outline, slides }, context) => {
      const pages = slides ?? (outline ?? []).map((item) => ({ title: item, bullets: [] }));
      const file = await createBridgeFile('createSlides', { title, slides: pages }, context.signal);
      return {
        mode: 'apps-script',
        kind: 'slides',
        title,
        slideCount: pages.length,
        fileId: file.fileId,
        url: file.url,
        label: 'ข้อมูลตัวอย่าง',
      };
    },
  },
);
