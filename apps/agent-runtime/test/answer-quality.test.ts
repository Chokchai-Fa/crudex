import { describe, expect, it } from 'vitest';
import { agents } from '../src/agents';

const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
const ids = ['jaew', 'jum', 'jeng', 'porn', 'nun', 'rungchao', 'lekha_por'];
const BLOCK = 'ลองถามต่อ:\n- <ข้อเสนอ 1>\n- <ข้อเสนอ 2>\n- <ข้อเสนอ 3>';

describe('answer quality and next-question contract', () => {
  it('gives all seven agents result-first, max-score and link-label rules', () => {
    for (const id of ids) {
      const t = byId[id]?.instructions ?? '';
      expect(t, id).toContain('บรรทัดแรกบอกสิ่งที่ทำเสร็จ');
      expect(t, id).toContain('คะแนนเต็มคู่กัน');
      expect(t, id).toContain('📄 ใบงาน PDF');
      expect(t, id).toContain('ห้ามทวนคำถาม');
    }
  });

  it('gives all seven agents the exact "ลองถามต่อ:" block, 2-3 items, ≤40 chars', () => {
    for (const id of ids) {
      const t = byId[id]?.instructions ?? '';
      expect(t, id).toContain(BLOCK);
      expect(t, id).toContain('2-3 ข้อ');
      expect(t, id).toContain('ไม่เกิน 40 ตัวอักษรไทย');
      expect(t, id).toContain('ยกเว้น');
    }
  });

  it('excludes the block from the published brief and from ask-gate confirmations', () => {
    expect(byId['rungchao']?.instructions).toContain(
      'สรุปเช้าที่เผยแพร่ด้วย publish_brief ห้ามมีบล็อกนี้',
    );
    for (const id of ids) {
      expect(byId[id]?.instructions, id).toMatch(/ยกเว้น.*(กดยืนยัน)/);
    }
  });

  it('keeps the chat short: no full worksheet, key or slide text when a file or card exists', () => {
    for (const id of ids) {
      const t = byId[id]?.instructions ?? '';
      expect(t, id).toContain('ห้ามวางเนื้อหาเต็ม');
      expect(t, id).toContain('เมื่อสร้างไฟล์ไม่ได้');
    }
    const jum = byId['jum']?.instructions ?? '';
    expect(jum).toContain('ตอบสั้นไม่เกิน 5 บรรทัด');
    expect(jum).toContain('ห้ามวาง worksheet.text โจทย์ ตัวเลือก หรือเฉลยลงในแชต');
    expect(jum).toContain('เฉลยลงในแชตเฉพาะเมื่อครูขอเฉลย');
    expect(jum).toContain('เฉพาะเมื่อสร้างไฟล์หรือการ์ดไม่ได้เลย (ทางสำรอง)');
    expect(jum).not.toContain('ต่อด้วยร่างคำถามทุกข้อ');
  });
});
