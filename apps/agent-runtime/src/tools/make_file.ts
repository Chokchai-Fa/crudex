import { z } from 'zod';
import { createBridgeFile } from '../lib/bridge-file';
import { ToolError } from './identity';
import { nonBlank, validatedTool } from './validated';

const keyHeading = 'เฉลย (สำหรับครู)';
type Section = { heading: string; body: string; pageBreakBefore?: boolean };

function fromContent(title: string, content: string, answerKey?: string): Section[] {
  let body = content;
  let key = answerKey;
  const split = /^\s*(?:\*\*)?เฉลย[^\n]*$/mu.exec(content);
  if (split) {
    body = content.slice(0, split.index).trimEnd();
    const rest = content
      .slice(split.index)
      .replace(/^\s*(?:\*\*)?เฉลย[^\S\n]*(?:\(สำหรับครู\))?[:：]?(?:\*\*)?[^\S\n]*/u, '')
      .trim();
    key ??= rest || undefined;
  }
  const parts: Section[] = [{ heading: title, body: body || content }];
  if (key) parts.push({ heading: keyHeading, body: key, pageBreakBefore: true });
  return parts;
}

// Students must not see the key: it goes last, on its own page.
function withKeyLast(sections: Section[] | undefined) {
  if (!sections) return;
  const isKey = (s: Section) => /^\s*เฉลย/u.test(s.heading);
  return [
    ...sections.filter((s) => !isKey(s)),
    ...sections.filter(isKey).map((s) => ({ ...s, pageBreakBefore: true })),
  ];
}

export const makeFile = validatedTool(
  z.strictObject({
    title: nonBlank.max(200),
    format: z.enum(['pdf', 'docx']),
    sections: z
      .array(
        z.strictObject({
          heading: nonBlank.max(200),
          body: nonBlank.max(8000),
          pageBreakBefore: z.boolean().optional(),
        }),
      )
      .min(1)
      .max(40)
      .optional(),
    content: nonBlank.max(60000).optional(),
    answerKey: nonBlank.max(8000).optional(),
  }),
  {
    name: 'make_file',
    description:
      'ออกใบงานเป็นไฟล์ PDF จริงบน Google Drive (ทุกคนที่มีลิงก์ดูได้) จากชุดที่ผ่านการตรวจ ใส่ format เป็น pdf, answerKey เป็นเฉลย (worksheet.answers) แยกจาก content เพื่อให้เฉลยอยู่หน้าสุดท้ายแยกจากโจทย์ และ content เป็นข้อความใบงานพร้อมเฉลยตามที่ check_assessment คืนมา (ไม่ต้องเรียบเรียงใหม่) หรือ sections เป็นรายการ {heading, body} คืน url และ label ข้อมูลตัวอย่าง ส่งลิงก์ตาม url ที่คืนมาเท่านั้น ยังไม่รองรับ docx ถ้าสร้างไม่สำเร็จให้บอกครูตรง ๆ ห้ามแต่งลิงก์',
    gate: 'allow',
    execute: async ({ title, format, sections, content, answerKey }, context) => {
      if (format !== 'pdf') throw new ToolError('unsupported_format', 'ตอนนี้สร้างได้เฉพาะ PDF');
      const parts = withKeyLast(
        sections ?? (content ? fromContent(title, content, answerKey) : undefined),
      );
      if (!parts)
        throw new ToolError('invalid_input', 'ใส่ content หรือ sections ที่มีเนื้อหาใบงานครบ');
      const file = await createBridgeFile('createPdf', { title, sections: parts }, context.signal);
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
