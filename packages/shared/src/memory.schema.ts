import { z } from 'zod';
const MAX_TEXT = 300;
const SENSITIVE: { code: string; test: RegExp; message: string }[] = [
  {
    code: 'national_id',
    test: /(?<!\d)\d[- ]?\d{4}[- ]?\d{5}[- ]?\d{2}[- ]?\d(?!\d)/,
    message: 'ห้ามบันทึกเลขบัตรประชาชน',
  },
  {
    code: 'phone',
    test: /(?<!\d)0\d{1,2}[- ]?\d{3,4}[- ]?\d{4}(?!\d)/,
    message: 'ห้ามบันทึกเบอร์โทร',
  },
  { code: 'email', test: /[\w.+-]+@[\w-]+\.[\w.-]+/, message: 'ห้ามบันทึกอีเมล' },
  {
    code: 'secret',
    test: /\b(sk-[A-Za-z0-9_-]{16,}|[A-Fa-f0-9]{32,})\b|รหัสผ่าน|password/i,
    message: 'ห้ามบันทึกรหัสผ่านหรือคีย์',
  },
  {
    code: 'score',
    test: /คะแนน[^\n]{0,24}\d|\d[^\n]{0,12}คะแนน|\d+\s*\/\s*\d+\s*(คะแนน|ข้อ)/,
    message: 'ห้ามบันทึกคะแนน ให้ใช้ get_scores',
  },
  {
    code: 'report',
    test: /รายงาน(ผล|ผู้ปกครอง)|ผลประเมิน/,
    message: 'ห้ามบันทึกรายงานหรือผลประเมิน',
  },
];

export function memoryIssue(text: string) {
  if (!text) return { code: 'empty', message: 'ข้อความว่าง' };
  if (text.length > MAX_TEXT) return { code: 'too_long', message: 'ข้อความยาวเกินกำหนด' };
  return SENSITIVE.find((rule) => rule.test.test(text));
}
export const memoryTextSchema = z
  .string()
  .max(2048)
  .transform((t) => t.normalize('NFC').replace(/\s+/g, ' ').trim())
  .refine((t) => !memoryIssue(t), 'Invalid memory content');
