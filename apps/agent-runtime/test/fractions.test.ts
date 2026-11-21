import { describe, expect, it } from 'vitest';
import sample from './fixtures/assessment-sample.json';
import {
  checkAssessment,
  evalExpr,
  evalStatement,
  parseNumberText,
  show,
  type Assessment,
} from '../src/lib/fractions';

const clone = (): Assessment => structuredClone(sample) as Assessment;
const q = (a: Assessment, id: string) => {
  const found = a.questions.find((x) => x.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('evalExpr', () => {
  it('reduces fraction arithmetic exactly', () => {
    expect(show(evalExpr('1/2+1/4'))).toBe('3/4');
    expect(show(evalExpr('7/8-1/4'))).toBe('5/8');
    expect(show(evalExpr('(4/7)/(2/7)'))).toBe('2');
    expect(show(evalExpr('2/3 × 3/4'))).toBe('1/2');
    expect(show(evalExpr('3/4 ÷ 3/8'))).toBe('2');
  });

  it('rejects an unparenthesized division chain', () => {
    expect(() => evalExpr('4/7/2/7')).toThrow('ใส่วงเล็บ');
    expect(() => evalExpr('1/2/3')).toThrow('ใส่วงเล็บ');
  });

  it('rejects division by zero and junk', () => {
    expect(() => evalExpr('1/(1-1)')).toThrow();
    expect(() => evalExpr('process.exit()')).toThrow();
  });

  it('evaluates comparisons to booleans', () => {
    expect(evalStatement('3/5 < 2/3')).toBe(true);
    expect(evalStatement('3/5 > 2/3')).toBe(false);
    expect(evalStatement('1/2 = 3/6')).toBe(true);
  });
});

describe('parseNumberText', () => {
  it('reads fractions, mixed numbers, decimals and ignores unit suffix', () => {
    expect(show(parseNumberText('5/8 เมตร') ?? { n: 0n, d: 1n })).toBe('5/8');
    expect(show(parseNumberText('1 1/4 ถ้วย') ?? { n: 0n, d: 1n })).toBe('5/4');
    expect(show(parseNumberText('0.5') ?? { n: 0n, d: 1n })).toBe('1/2');
    expect(parseNumberText('เปรียบเทียบไม่ได้')).toBeUndefined();
  });
});

describe('checkAssessment', () => {
  it('accepts the sample set and proves 9 of 10 keys by code', () => {
    const r = checkAssessment(clone());
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.verified).toHaveLength(10);
    expect(r.unverified).toEqual([]);
  });

  it('rejects a wrong key found through verify', () => {
    const a = clone();
    q(a, 'q1').correctChoiceId = 'c1';
    const r = checkAssessment(a);
    expect(r.ok).toBe(false);
    expect(r.errors.find((e) => e.questionId === 'q1')?.code).toBe('wrong_key');
  });

  it('catches a wrong key from the stem alone when verify is omitted', () => {
    const a = clone();
    const item = q(a, 'q5');
    delete item.verify;
    item.correctChoiceId = 'c4';
    const e = checkAssessment(a).errors.find((x) => x.questionId === 'q5');
    expect(e?.code).toBe('wrong_key');
    expect(e?.message).toContain('5/8');
  });

  it('rejects distractors whose reduced value equals the key', () => {
    const a = clone();
    const item = q(a, 'q6');
    item.choices[0] = { id: 'c1', text: '3/6' };
    const e = checkAssessment(a).errors.filter((x) => x.questionId === 'q6');
    expect(e.map((x) => x.code)).toContain('duplicate_value');
  });

  it('rejects a key not among the choices and a verify mismatch', () => {
    const a = clone();
    q(a, 'q2').correctChoiceId = 'c9';
    q(a, 'q3').verify = { expr: '1/3+1/2', expected: '2/5' };
    const codes = checkAssessment(a).errors.map((x) => `${x.questionId}:${x.code}`);
    expect(codes).toContain('q2:key_missing');
    expect(codes).toContain('q3:verify_mismatch');
  });

  it('rejects a comparison question with a wrong true statement', () => {
    const a = clone();
    q(a, 'q7').correctChoiceId = 'c1';
    const e = checkAssessment(a).errors.find((x) => x.questionId === 'q7');
    expect(e?.code).toBe('wrong_key');
  });

  it('rejects a largest-value question with a wrong key', () => {
    const a = clone();
    q(a, 'q8').correctChoiceId = 'c1';
    expect(checkAssessment(a).errors.find((x) => x.questionId === 'q8')?.code).toBe('wrong_key');
  });

  it('checks the division form the Engineer asked for', () => {
    const a = clone();
    const item = q(a, 'q1');
    item.text = 'ค่าของ (4/7)/(2/7) เท่ากับเท่าใด';
    item.verify = { expr: '(4/7)/(2/7)', expected: '2' };
    item.choices = [
      { id: 'c1', text: '1/2' },
      { id: 'c2', text: '2' },
      { id: 'c3', text: '8/49' },
      { id: 'c4', text: '4' },
    ];
    item.correctChoiceId = 'c2';
    expect(checkAssessment(a).errors).toEqual([]);
    item.correctChoiceId = 'c1';
    expect(checkAssessment(a).errors.map((e) => e.code)).toContain('wrong_key');
  });

  it('flags a calculation word problem without verify as unverified rather than passing it silently', () => {
    const a = clone();
    delete q(a, 'q9').verify;
    const r = checkAssessment(a);
    expect(r.ok).toBe(true);
    expect(r.unverified).toEqual(['q9']);
  });

  it('accepts any count by default but enforces the count the teacher asked for', () => {
    const a = clone();
    a.questions = a.questions.slice(0, 3);
    expect(checkAssessment(a).ok).toBe(true);
    expect(checkAssessment(a, { expectedCount: 3 }).ok).toBe(true);
    expect(checkAssessment(a, { expectedCount: 10 }).errors.map((e) => e.code)).toEqual([
      'count_mismatch',
    ]);
  });

  it('still supports an explicit minimum', () => {
    const a = clone();
    a.questions = a.questions.slice(0, 5);
    expect(checkAssessment(a, { minQuestions: 10 }).errors.map((e) => e.code)).toContain('too_few');
  });
});

describe('powers and exact square roots', () => {
  it('evaluates ^ and sqrt for perfect squares only', () => {
    expect(show(evalExpr('7^2+24^2'))).toBe('625');
    expect(show(evalExpr('sqrt(7^2+24^2)'))).toBe('25');
    expect(show(evalExpr('sqrt(9/16)'))).toBe('3/4');
    expect(show(evalExpr('2*sqrt(36)'))).toBe('12');
    expect(() => evalExpr('sqrt(2)')).toThrow('ลงตัว');
    expect(() => evalExpr('sqrt(0-4)')).toThrow();
    expect(() => evalExpr('2^99')).toThrow('ไม่เกิน');
    expect(() => evalExpr('sqrt(4')).toThrow('วงเล็บ');
  });

  it('verifies a side-length question that needs a square root', () => {
    const q = {
      id: 'q1',
      text: 'บันไดวางพิงกำแพงสูง 7 เมตร ปลายล่างห่างจากกำแพง 24 เมตร บันไดยาวกี่เมตร',
      topic: 'ทฤษฎีบทพีทาโกรัส',
      choices: [
        { id: 'c1', text: '25 เมตร' },
        { id: 'c2', text: '31 เมตร' },
        { id: 'c3', text: '17 เมตร' },
        { id: 'c4', text: '23 เมตร' },
      ],
      correctChoiceId: 'c1',
      verify: { expr: 'sqrt(7^2+24^2)', expected: '25' },
    };
    const ok = checkAssessment({ title: 't', grade: 'ม.2', topic: 'x', questions: [q] });
    expect(ok.errors).toEqual([]);
    const wrong = checkAssessment({
      title: 't',
      grade: 'ม.2',
      topic: 'x',
      questions: [{ ...q, correctChoiceId: 'c2' }],
    });
    expect(wrong.ok).toBe(false);
  });
});
