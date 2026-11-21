import { describe, expect, it } from 'vitest';
import { agents } from '../src/agents';
import { personas } from '../src/agents/persona';

const byId = Object.fromEntries(agents.map((a) => [a.id, a]));
const seven = ['jaew', 'jum', 'jeng', 'porn', 'nun', 'rungchao', 'lekha_por'];

describe('personas', () => {
  it('give every one of the seven agents its own voice and the shared rules', () => {
    expect(Object.keys(personas).sort()).toEqual([...seven].sort());
    for (const id of seven) {
      const text = byId[id]?.instructions ?? '';
      expect(text.startsWith('บุคลิกและน้ำเสียง'), id).toBe(true);
      expect(text, id).toContain('ต้องคงตามเดิมทุกตัวอักษร');
      expect(text, id).toContain('ไม่เกิน 1 ตัวต่อข้อความ');
      expect(text, id).toContain('กดแล้วจะเกิดอะไรขึ้น');
    }
  });

  it('uses the self-reference and ending each agent was given', () => {
    const expected: Record<string, string[]> = {
      jaew: ['"หนู"', '"ค่ะ" หรือ "นะคะ"', 'ให้หนูจำไว้ไหมคะ'],
      jum: ['"หนู"', 'หนูเช็กเฉลยทุกข้อแล้วนะคะ'],
      jeng: ['"พี่"', '"ครับ"', 'จัดไปครับ!'],
      porn: ['"ป้า"', '"จ้ะ" หรือ "นะจ๊ะ"'],
      nun: ['"หนู"', '"ค่ะ"'],
      rungchao: ['"รุ่งเช้า"', 'ท่าน ผอ.', 'ไม่เกิน 7 บรรทัด'],
      lekha_por: ['"ลุง"', '"ครับ"', 'ท่าน ผอ.', 'ให้ลุงจำไว้ไหมครับ'],
    };
    for (const [id, parts] of Object.entries(expected)) {
      for (const part of parts) expect(byId[id]?.instructions, `${id}: ${part}`).toContain(part);
    }
  });

  it('keeps nun from mocking or labelling students and ลุงนิต from approving without a clear confirm message', () => {
    expect(byId['nun']?.instructions).toContain('ห้ามล้อเลียน ตัดสิน หรือตีตรานักเรียนเด็ดขาด');
    expect(byId['lekha_por']?.instructions).toContain(
      'การกดยืนยันจะทำให้เอกสารถูกอนุมัติหรือส่งกลับ',
    );
  });

  it('never says ผม for the memory question any more', () => {
    for (const id of seven) expect(byId[id]?.instructions, id).not.toContain('ให้ผมจำไว้ไหม');
  });
});
