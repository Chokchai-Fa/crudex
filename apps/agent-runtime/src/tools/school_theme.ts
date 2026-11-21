import type { ToolDefinition } from './types';

export const schoolTheme: ToolDefinition = {
  name: 'school_theme',
  description: 'อ่านธีมของโรงเรียน (สี โลโก้) สำหรับสไลด์และชีต (ตัวจำลอง: ธีมตัวอย่าง ไม่ใช่ของโรงเรียนจริง)',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => ({ mode: 'mock', name: 'โรงเรียนตัวอย่าง', primaryColor: '#1F4E79', accentColor: '#F2A900', logoUrl: null }),
};
