import { z } from 'zod';
import { createBridgeFile } from '../lib/bridge-file';
import { ToolError } from './identity';
import { nonBlank, validatedTool } from './validated';

export const makeFile = validatedTool(
  z.strictObject({
    title: nonBlank.max(200),
    format: z.enum(['pdf', 'docx']),
    sections: z
      .array(z.strictObject({ heading: nonBlank.max(200), body: nonBlank.max(8000) }))
      .min(1)
      .max(40)
      .optional(),
  }),
  {
    name: 'make_file',
    description:
      'ออกใบงานเป็นไฟล์ PDF จริงบน Google Drive (ทุกคนที่มีลิงก์ดูได้) จากชุดที่ผ่านการตรวจ ใส่ format เป็น pdf และ sections เป็นรายการ {heading, body} ที่มีเนื้อหาครบ คืน url และ label ข้อมูลตัวอย่าง ส่งลิงก์ตาม url ที่คืนมาเท่านั้น ยังไม่รองรับ docx ถ้าสร้างไม่สำเร็จให้บอกครูตรง ๆ ห้ามแต่งลิงก์',
    gate: 'allow',
    execute: async ({ title, format, sections }, context) => {
      if (format !== 'pdf') throw new ToolError('unsupported_format', 'ตอนนี้สร้างได้เฉพาะ PDF');
      if (!sections)
        throw new ToolError('invalid_input', 'ใส่ sections ({heading, body}) ที่มีเนื้อหาใบงานครบ');
      const file = await createBridgeFile('createPdf', { title, sections }, context.signal);
      return {
        mode: 'apps-script',
        kind: 'pdf',
        title,
        fileId: file.fileId,
        url: file.url,
        label: 'ข้อมูลตัวอย่าง',
      };
    },
  },
);
