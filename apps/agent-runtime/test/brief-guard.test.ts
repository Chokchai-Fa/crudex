import { describe, expect, it } from 'vitest';
import { checkBrief } from '../src/lib/brief-guard';

const date = '21 พฤศจิกายน พ.ศ. 2569';
const brief = [
  date,
  'ผลการเรียน ป.5/2 ต่ำกว่าเกณฑ์',
  'งบประมาณใช้ไป 75%',
  'กิจกรรม M-01 เสี่ยงเกินงบ',
  'เอกสารรออนุมัติ 2 รายการ',
  'เมื่อวานครูส่งใบงาน 3 ชุด',
  'ขอให้ ผอ. พิจารณาปรับงบกิจกรรม M-01',
];

describe('checkBrief', () => {
  it('accepts a seven-line brief', () => {
    expect(checkBrief(brief.join('\n'))).toEqual({ ok: true, errors: [] });
  });

  it('rejects an eight-line brief', () => {
    expect(checkBrief([...brief, 'ข้อมูลเพิ่มเติม'].join('\n'))).toMatchObject({
      ok: false,
      errors: [{ code: 'too_many_lines' }],
    });
  });

  it.each(['s-07', 'นักเรียนตัวอย่าง 03', 'เลขที่ 12'])('flags %s on its line', (reference) => {
    expect(checkBrief(`${date}\n${reference}`)).toMatchObject({
      ok: false,
      errors: [{ code: 'student_ref', line: 2 }],
    });
  });

  it('flags an extra name using its original line number', () => {
    expect(
      checkBrief(`${date}\r\n\r\nสมมติ ใจดี ส่งงานแล้ว`, { names: ['สมมติ ใจดี'] }),
    ).toMatchObject({
      ok: false,
      errors: [{ code: 'student_ref', line: 3 }],
    });
  });

  it('counts only non-empty lines', () => {
    expect(checkBrief(brief.join('\n \t\n'))).toEqual({ ok: true, errors: [] });
  });

  it('honors a custom line limit', () => {
    expect(checkBrief(brief.join('\n'), { maxLines: 6 })).toMatchObject({
      ok: false,
      errors: [{ code: 'too_many_lines' }],
    });
  });

  it.each(['', '\n \t\r\n'])('rejects an empty or blank brief %j', (input) => {
    expect(checkBrief(input)).toMatchObject({ ok: false, errors: [{ code: 'empty' }] });
  });
});
