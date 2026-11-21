import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { agents } from '../src/agents';
import { decide, permissionsFor } from '../src/permissions';

const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
const teachers = ['jaew', 'jum', 'jeng', 'porn', 'nun'];
const principals = ['rungchao', 'lekha_por'];
const skill = (id: string) =>
  readFileSync(new URL(`../skills/${id}/SKILL.md`, import.meta.url), 'utf8');

describe('act first with defaults from context', () => {
  it('gives all seven agents the rule: no question back unless it truly cannot be inferred, then exactly one', () => {
    for (const id of [...teachers, ...principals]) {
      const text = byId[id]?.instructions ?? '';
      expect(text, id).toContain('ลงมือทำก่อน');
      expect(text, id).toContain('ไม่ถามกลับ');
      expect(text, id).toContain('อนุมานไม่ได้จริง ๆ');
      expect(text, id).toContain('1 คำถาม');
      expect(text, id).toContain('กดยืนยัน');
    }
  });

  it('"สร้างใบงาน ป.4/3": jum has the defaults to make a 10-item PDF worksheet without asking', () => {
    const text = byId['jum']?.instructions ?? '';
    for (const part of [
      'ใบงานและข้อสอบ 10 ข้อ ก-ง',
      'ใบงานเป็นไฟล์ PDF',
      'หัวข้อแรกของชั้นนั้นจาก curriculum_lookup',
      'ห้ามแต่งรหัสตัวชี้วัด',
      'ท้ายคำตอบใส่ 1 บรรทัดสั้น ๆ บอกค่าที่ใช้',
    ]) {
      expect(text, part).toContain(part);
    }
    expect(skill('worksheet')).toContain('ห้ามถามกลับ');
    expect(skill('worksheet')).toContain('จำนวนข้อ 10 ข้อ ก-ง');
    expect(skill('worksheet')).not.toContain('ให้ถามกลับ 1 คำถาม');
  });

  it('"ทำสไลด์": jeng has the defaults to make 6-8 slides without asking, and Kahoot defaults to 10', () => {
    const text = byId['jeng']?.instructions ?? '';
    expect(text).toContain('สไลด์ 6-8 หน้า');
    expect(text).toContain('เกม Kahoot 10 ข้อ');
    expect(text).toContain('เมื่อครูขอสไลด์ ให้เรียก make_slides');
    expect(skill('kahoot-game')).toContain('10 ข้อ (ถ้าครูไม่ระบุ)');
  });

  it('makes the exam default 10 items and stops the exam skill asking about class, topic or time', () => {
    expect(skill('exam')).toContain('ค่าเริ่มต้น 10 ข้อ');
    expect(skill('exam')).toContain('ห้ามถามกลับ');
    expect(skill('exam')).not.toContain('ค่าเริ่มต้น 20 ข้อ');
  });

  it('keeps lesson prep to its single menu question and makes jaew hand the defaults to the helper', () => {
    const text = byId['jaew']?.instructions ?? '';
    expect(text).toContain('ขั้นเตรียมสอนคงคำถามเดียวคือให้ครูเลือกงานจากเมนู');
    expect(text).toContain('ใส่ค่าเริ่มต้นครบ (ห้อง หัวข้อ จำนวน)');
    expect(text).toContain('ห้ามส่งงานสร้างสื่อก่อนครูเลือก');
  });

  it('keeps the 7-line morning brief free of a defaults line', () => {
    expect(byId['rungchao']?.instructions).toContain('สรุปเช้าไม่ต้องใส่บรรทัดค่าเริ่มต้น');
  });

  it('does not remove any confirmation gate', () => {
    expect(decide(permissionsFor(byId['porn'] as never), 'send_email', ['*'])).toBe('ask');
    expect(decide(permissionsFor(byId['porn'] as never), 'submit_for_approval', ['*'])).toBe('ask');
    expect(decide(permissionsFor(byId['lekha_por'] as never), 'decide_approval', ['*'])).toBe(
      'ask',
    );
    expect(byId['lekha_por']?.instructions).toContain(
      'ห้ามอนุมัติหรือส่งกลับโดยไม่ได้ยินคำสั่งชัดเจน',
    );
  });
});
