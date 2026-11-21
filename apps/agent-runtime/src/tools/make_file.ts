import type { ToolDefinition } from './types';

export const makeFile: ToolDefinition = {
  name: 'make_file',
  description: 'ออกใบงานเป็นไฟล์ A4 (PDF/DOCX) จากชุดที่ผ่านการตรวจ (ตัวจำลอง: คืนรหัสไฟล์ตัวอย่าง ยังไม่ได้สร้างไฟล์จริง)',
  input: {"type": "object", "properties": {"title": {"type": "string"}, "format": {"type": "string", "enum": ["pdf", "docx"]}}, "required": ["title", "format"], "additionalProperties": false},
  gate: 'allow',
  execute: (input) => ({
    mode: 'mock',
    fileId: 'file-' + crypto.randomUUID().slice(0, 8),
    note: 'ตัวอย่าง: ยังไม่ได้สร้างไฟล์จริง',
    request: input,
  }),
};
