import { describe, expect, it } from 'vitest';
import { jaew } from '../src/agents/jaew';
import { jum } from '../src/agents/jum';
import { nun } from '../src/agents/nun';
import { decide, permissionsFor } from '../src/permissions';

const text = jaew.instructions;

describe('jaew lesson preparation flow', () => {
  it('reads the room, memory and the history before asking, in that order', () => {
    const steps = [
      '(1) จับชื่อห้อง',
      '(2) เรียก memory_search',
      '(3) ส่งงานให้ nun',
      '(5) สรุปให้ครู 3-4 บรรทัด',
      '(6) เมื่อครูเลือกแล้ว',
    ];
    const positions = steps.map((step) => text.indexOf(step));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('asks before doing and offers the six choices with the exact labels', () => {
    for (const label of [
      '1) สื่อการสอน/สไลด์ — พี่เจ๋ง',
      '2) ใบงาน/การบ้าน — น้องจ๋ำ',
      '3) แบบทดสอบ Google Form — น้องจ๋ำ',
      '4) เกม Kahoot — พี่เจ๋ง',
      '5) กิจกรรมในคาบ — พี่เจ๋ง',
      '6) ข้อสอบ — น้องจ๋ำ',
    ]) {
      expect(text, label).toContain(label);
    }
    expect(text).toContain('ห้ามส่งงานสร้างสื่อก่อนครูเลือก');
    expect(text).toContain('ห้ามเริ่มทำอะไรก่อนครูตอบ');
    expect(text).toContain('เลือกได้หลายข้อ');
  });

  it('keeps memory of other rooms out and says plainly when there is no data', () => {
    expect(text).toContain('ห้ามใช้ความจำที่ระบุห้องอื่น');
    expect(text).toContain('ยังไม่มีข้อมูลคะแนนของห้องนี้');
    expect(text).toContain('ห้ามเดาตัวเลข');
  });

  it('can start nun but not read scores itself', () => {
    const rules = permissionsFor(jaew);
    expect(decide(rules, 'subagent', ['nun'])).toBe('allow');
    expect(decide(rules, 'get_scores', ['*'])).toBe('deny');
  });

  it('tells nun to pass the room label through and report refusals and missing data', () => {
    expect(nun.instructions).toContain('classLabel');
    expect(nun.instructions).toContain('class_not_taught');
    expect(nun.instructions).toContain('ยังไม่มีข้อมูลคะแนนของห้องนี้');
  });

  it('is bound to the lesson-prep skill and still has no other skill', () => {
    expect(jaew.skills).toEqual(['lesson-prep']);
  });

  it('uses the score history for a trend and for repeat below-threshold students, without computing it itself', () => {
    expect(nun.instructions).toContain('repeatedlyBelowThreshold');
    expect(nun.instructions).toContain('ห้ามคำนวณเอง');
    expect(jaew.instructions).toContain('แนวโน้มจากครั้งก่อน');
    expect(jaew.instructions).toContain('ต่ำกว่าเกณฑ์ซ้ำ');
    expect(jaew.instructions).toContain('จำนวนเด็กที่ต้องทบทวน (ไม่ใส่ชื่อเด็ก)');
  });

  it('sends a question count with every delegated set: the teacher\u2019s number, else 10', () => {
    expect(jaew.instructions).toContain('ต้องใส่จำนวนข้อเป็นตัวเลขใน prompt เสมอ');
    expect(jaew.instructions).toContain('ถ้าครูไม่ระบุให้ใช้ 10 ข้อ');
    expect(jaew.instructions).toContain('ห้ามเดาน้อยกว่า 10 เอง');
    expect(jum.instructions).toContain('ห้ามใช้ 1 หรือจำนวนน้อยกว่านั้นโดยครูไม่ได้ขอ');
  });

  it('prints a chat-only worksheet in the order check_assessment returns', () => {
    expect(jum.instructions).toContain('worksheetOrder');
    expect(jum.instructions).toContain('ห้ามใช้ลำดับที่เขียนเอง');
  });
});
