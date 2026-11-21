import { beforeEach, describe, expect, it } from 'vitest';
import sample from './fixtures/assessment-sample.json';
import { tools } from '../src/tools';
import { approvalBox, testMailbox } from '../src/tools/inbox';
import { resetMemory } from '../src/tools/memory-store';
import { publisher } from '../src/tools/save_assessment';
import type { ToolContext } from '../src/tools/types';

const ctx = (extra: Partial<ToolContext> = {}): ToolContext => ({
  count: 1,
  signal: new AbortController().signal,
  ...extra,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (
  name: string,
  input: unknown,
  context = ctx(),
): Promise<Record<string, any>> => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error('missing ' + name);
  return (await tool.execute(input, context)) as Record<string, never>;
};

beforeEach(() => resetMemory());

describe('tool catalog', () => {
  it('has unique names and an object schema without extra properties on every tool', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of tools) {
      expect((t.input as { type: string }).type).toBe('object');
      expect((t.input as { additionalProperties: boolean }).additionalProperties).toBe(false);
    }
  });
});

describe('memory', () => {
  it('requires the user’s confirmation and scopes by owner', async () => {
    await expect(
      call('memory_save', { text: 'ห้อง ป.5/2 อ่อนเรื่องตัวส่วน', userConfirmed: false }),
    ).rejects.toMatchObject({ code: 'not_confirmed' });
    await call(
      'memory_save',
      { text: 'ห้อง ป.5/2 อ่อนเรื่องตัวส่วน', userConfirmed: true },
      ctx({ ownerId: 't1' }),
    );
    expect(
      (await call('memory_search', { query: 'ตัวส่วน' }, ctx({ ownerId: 't1' }))).items,
    ).toHaveLength(1);
    expect(
      (await call('memory_search', { query: 'ตัวส่วน' }, ctx({ ownerId: 't2' }))).items,
    ).toEqual([]);
  });

  it('refuses a score and personal data', async () => {
    for (const text of ['นักเรียนตัวอย่าง 07 ได้ 6 คะแนน', 'โทร 081-234-5678', 'a@b.co']) {
      await expect(call('memory_save', { text, userConfirmed: true })).rejects.toBeInstanceOf(
        Error,
      );
    }
  });
});

describe('assessment chain', () => {
  it('check_assessment proves the sample set and rejects a wrong key and a duplicate value', async () => {
    expect((await call('check_assessment', sample)).ok).toBe(true);
    const bad = structuredClone(sample);
    bad.questions[0]!.correctChoiceId = 'c1';
    expect((await call('check_assessment', bad)).errors[0]).toMatchObject({
      questionId: 'q1',
      code: 'wrong_key',
    });
    const dup = structuredClone(sample);
    dup.questions[5]!.choices[0] = { id: 'c1', text: '3/6' };
    expect(
      (await call('check_assessment', dup)).errors.map((e: { code: string }) => e.code),
    ).toContain('duplicate_value');
  });

  it('save_assessment publishes only a verified set with the requested size', async () => {
    const published: unknown[] = [];
    const real = publisher.publish;
    publisher.publish = async (a) => {
      published.push(a);
      return { mode: 'mock', formId: 'f1', url: 'https://example.invalid/f1' };
    };
    try {
      expect(await call('save_assessment', sample)).toEqual({
        formUrl: 'https://example.invalid/f1',
        mode: 'mock',
        formId: 'f1',
      });
      const bad = structuredClone(sample);
      bad.questions[0]!.correctChoiceId = 'c1';
      await expect(call('save_assessment', bad)).rejects.toMatchObject({
        code: 'invalid_assessment',
      });
      await expect(call('save_assessment', { ...sample, expectedCount: 3 })).rejects.toMatchObject({
        code: 'invalid_assessment',
      });
      expect(published).toHaveLength(1);
    } finally {
      publisher.publish = real;
    }
  });

  it('curriculum_lookup returns real ids only and flags the review state', async () => {
    const r = await call('curriculum_lookup', { grade: 'ป.5', query: 'เศษส่วน' });
    expect(r.items.map((i: { id: string }) => i.id)).toContain('ค 1.1 ป.5/3');
    expect(r.topics.map((t: { topic: string }) => t.topic)).toContain(
      'การบวก การลบของเศษส่วนและจำนวนคละ',
    );
    expect(JSON.stringify(r)).not.toContain('ยังไม่ผ่านครูตรวจ');
    expect((await call('curriculum_lookup', { id: 'ค 9.9 ป.5/9' })).items).toEqual([]);
  });
});

describe('get_scores', () => {
  it('computes class numbers by code', async () => {
    const r = await call('get_scores', {}, ctx({ classId: 'class-p5-2', ownerId: 't' }));
    expect(r.n).toBe(20);
    expect(r.mean).toBe(6.8);
    expect(r.threshold).toBe(5);
    expect(r.belowThreshold.map((s: { studentId: string }) => s.studentId)).toEqual([
      's-03',
      's-12',
      's-19',
    ]);
    expect(r.wrongByTopic[0]).toMatchObject({
      topic: 'การบวก การลบของเศษส่วนและจำนวนคละ',
      wrong: 43,
      total: 120,
    });
  });
});

describe('budget chain', () => {
  it('calc is exact', async () => {
    expect(await call('calc', { expr: '120*5+0.5' })).toMatchObject({
      exact: '1201/2',
      decimal: 600.5,
    });
    await expect(call('calc', { expr: 'process.exit()' })).rejects.toMatchObject({
      code: 'bad_expression',
    });
  });

  it('fill_claim_form totals by code, flags over-budget and leaves the signature empty', async () => {
    const ok = await call('fill_claim_form', {
      budgetCode: 'M-01',
      purpose: 'กระดาษ',
      items: [{ name: 'A4', qty: 10, unitPrice: 120 }],
    });
    expect(ok).toMatchObject({
      total: 1200,
      remainingAfter: 2400,
      overBudget: false,
      signature: null,
    });
    expect(ok.label).toContain('ตัวอย่าง');
    const over = await call('fill_claim_form', {
      budgetCode: 'M-01',
      purpose: 'กระดาษ',
      items: [{ name: 'A4', qty: 40, unitPrice: 120 }],
    });
    expect(over.overBudget).toBe(true);
    await expect(
      call('fill_claim_form', {
        budgetCode: 'X',
        purpose: 'x',
        items: [{ name: 'a', qty: 1, unitPrice: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'unknown_budget_code' });
  });

  it('submits to the in-system approval box and mails only the test mailbox', async () => {
    const a = await call('submit_for_approval', { claimId: 'claim-1' });
    expect(a.status).toBe('pending');
    expect(approvalBox.at(-1)?.to).toBe('principal');
    const m = await call('send_email', { to: 'someone@real.example', subject: 's', body: 'b' });
    expect(m.deliveredTo).toBe('test-mailbox');
    expect(testMailbox.at(-1)?.to).toBe('test-mailbox');
  });
});
