import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleOwner } from '../src/data/sample';
import sample from './fixtures/assessment-sample.json';
import { tools } from '../src/tools';
import { approvals, resetApprovals } from '../src/tools/approval-store';
import { testMailbox } from '../src/tools/inbox';
import { resetMemory } from '../src/tools/memory-store';
import { formQuestions, publisher } from '../src/tools/save_assessment';
import type { ToolContext } from '../src/tools/types';

const ctx = (extra: Partial<ToolContext> = {}): ToolContext => ({
  count: 1,
  signal: new AbortController().signal,
  ...extra,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ToolResult = Record<string, any>;
const call = async (name: string, input: unknown, context = ctx()): Promise<ToolResult> => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error('missing ' + name);
  return (await tool.execute(input, context)) as ToolResult;
};

beforeEach(() => {
  resetMemory();
  resetApprovals();
  testMailbox.length = 0;
});

const claimInput = {
  budgetCode: 'M-01',
  purpose: 'กระดาษ',
  items: [{ name: 'A4', qty: 10, unitPrice: 120 }],
};

it.each([
  ['check_assessment', { ...sample, questions: [null] }],
  ['check_assessment', { ...sample, expectedCount: 0 }],
  ['check_assessment', { ...sample, questions: Array(31).fill(sample.questions[0]) }],
  ['save_assessment', { ...sample, formUrl: 'https://example.invalid/' }],
  ['fill_claim_form', { ...claimInput, items: [] }],
  ['fill_claim_form', { ...claimInput, items: [{ name: 'A4', qty: -1, unitPrice: 10 }] }],
  ['fill_claim_form', { ...claimInput, items: [{ name: 'A4', qty: 1, unitPrice: -10 }] }],
  ['fill_claim_form', { ...claimInput, items: [{ name: 'A4', qty: 1, unitPrice: Infinity }] }],
  ['fill_claim_form', { ...claimInput, total: 0 }],
  ['memory_save', { text: false, userConfirmed: true }],
  ['memory_save', { text: 'ข้อความ', userConfirmed: 'true' }],
  ['memory_search', { query: 1 }],
  ['memory_search', { query: '', limit: 11 }],
  ['calc', { expr: 10 }],
  ['calc', { expr: '1'.repeat(2049) }],
  ['send_email', { subject: 's', body: 'b' }],
  ['send_email', { to: 'sample', subject: 's', body: {} }],
  ['submit_for_approval', { claimId: 'claim-sample', note: 3 }],
  ['get_scores', { classId: 'class-p5-3' }],
  ['get_scores', { classLabel: 2 }],
  ['curriculum_lookup', { query: [] }],
  ['old_exam_search', { exam: 'OTHER' }],
  ['read_budget', { code: 4 }],
  ['search_proj14', { topic: {} }],
  ['task_status', { taskId: 1 }],
  ['make_file', { title: 'Worksheet', format: 'pdf', url: 'https://example.invalid/' }],
  ['make_sheet', { title: 'Worksheet', topic: 1 }],
  ['make_slides', { title: 'Worksheet', outline: [] }],
])('%s rejects malformed input before execution', async (name, input) => {
  await expect(call(name, input)).rejects.toMatchObject({ code: 'invalid_input' });
  expect(approvals).toHaveLength(0);
  expect(testMailbox).toHaveLength(0);
});

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

  it('shares the sample teacher across sessions until the gateway passes an owner', async () => {
    await call(
      'memory_save',
      { text: 'ห้อง ป.5/2', userConfirmed: true },
      ctx({ sessionID: 'first' }),
    );
    expect(
      (await call('memory_search', { query: 'ป.5/2' }, ctx({ sessionID: 'second' }))).items,
    ).toHaveLength(1);
    expect(
      (await call('memory_search', { query: 'ป.5/2' }, ctx({ ownerId: 'someone-else' }))).items,
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
    const checked = await call('check_assessment', sample);
    expect(checked).toMatchObject({ ok: true, count: 10, verifiedCount: 10, unverifiedCount: 0 });
    expect(
      checked.topics.reduce((sum: number, topic: { count: number }) => sum + topic.count, 0),
    ).toBe(checked.count);
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
      return {
        mode: 'mock',
        formId: 'f1',
        url: 'https://example.invalid/f1',
        questions: formQuestions(a.questions),
      };
    };
    try {
      expect(await call('save_assessment', sample)).toMatchObject({
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
  it('lists only the teacher’s rooms when the requested room is not taught', async () => {
    await expect(call('get_scores', { classLabel: 'ป.5/3' })).rejects.toMatchObject({
      code: 'class_not_taught',
      message: 'เลือกได้เฉพาะห้องที่ครูสอน ได้แก่ ป.5/2, ม.2/1, ม.2/2',
    });
    await expect(call('get_scores', {}, ctx({ classId: 'class-p5-3' }))).rejects.toMatchObject({
      code: 'class_not_taught',
    });
  });

  it('refuses an unassigned owner even with a valid room in both input and context', async () => {
    await expect(
      call(
        'get_scores',
        { classLabel: 'ม.2/1' },
        ctx({ ownerId: 'unassigned-teacher', classId: 'class-m2-1' }),
      ),
    ).rejects.toMatchObject({
      code: 'class_not_taught',
      message: 'ยังไม่มีห้องที่ครูสอนในระบบ',
    });
  });

  it.each(['ม2/1', '  ม. 2/1  ', 'ม.2/1', 'class-m2-1'])(
    'resolves %s to the same room',
    async (classLabel) => {
      expect(await call('get_scores', { classLabel })).toMatchObject({
        classId: 'class-m2-1',
        label: 'ม.2/1',
        hasData: true,
      });
    },
  );

  it.each(['ป5/2', '  ป. 5/2  ', 'ป.5/2'])('resolves %s to ป.5/2', async (classLabel) => {
    expect(await call('get_scores', { classLabel })).toMatchObject({ label: 'ป.5/2' });
  });

  it('uses the session room when no room is requested', async () => {
    expect(await call('get_scores', {}, ctx({ classId: 'class-m2-1' }))).toMatchObject({
      classId: 'class-m2-1',
    });
  });

  it('returns a message without scores for a taught room with no history', async () => {
    expect(await call('get_scores', { classLabel: 'ม.2/2' })).toEqual({
      hasData: false,
      classId: 'class-m2-2',
      label: 'ม.2/2',
      message: 'ยังไม่มีข้อมูลคะแนนของห้องนี้',
    });
  });

  it('computes the scores and topic counts for ม.2/1', async () => {
    const r = await call('get_scores', { classLabel: 'ม.2/1' });
    expect(r).toMatchObject({
      title: 'ตัวอย่าง: แบบฝึกหัดพีทาโกรัส ม.2/1',
      topic: 'ทฤษฎีบทพีทาโกรัสและบทกลับ',
      maxScore: 6,
      threshold: 3,
      n: 8,
      mean: 3.5,
    });
    expect(r.students.map((student: { score: number }) => student.score)).toEqual([
      4, 3, 5, 2, 3, 4, 6, 1,
    ]);
    expect(r.belowThreshold).toEqual([
      { studentId: 's-04', displayName: 'นักเรียนตัวอย่าง 04', score: 2 },
      { studentId: 's-08', displayName: 'นักเรียนตัวอย่าง 08', score: 1 },
    ]);
    expect(r.wrongByTopic).toEqual([
      {
        topic: 'การนำความรู้เกี่ยวกับทฤษฎีบทพีทาโกรัสและบทกลับไปใช้ในชีวิตจริง',
        wrong: 15,
        total: 24,
        wrongRate: 0.625,
      },
      { topic: 'ทฤษฎีบทพีทาโกรัสและบทกลับ', wrong: 5, total: 24, wrongRate: 0.208 },
    ]);
  });

  it('defaults to the teacher’s first room and preserves its numbers', async () => {
    const r = await call('get_scores', {}, ctx({ ownerId: sampleOwner }));
    expect(r.label).toBe('ป.5/2');
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

  it('keeps the decimal finite when the exact numerator and denominator exceed Number range', async () => {
    const digits = '2'.repeat(330);
    expect(await call('calc', { expr: `${digits}/${'3'.repeat(330)}` })).toMatchObject({
      exact: '2/3',
      decimal: 0.666667,
    });
    // Coprime operands of comparable size stay large after reducing the fraction.
    expect(await call('calc', { expr: `${digits}/(${digits}+1)` })).toMatchObject({ decimal: 1 });
    expect(await call('calc', { expr: '-0.0000005' })).toMatchObject({ decimal: 0 });
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

  it('rounds each exact decimal line to the satang before totaling', async () => {
    const claim = await call('fill_claim_form', {
      ...claimInput,
      items: [
        { name: 'A', qty: 1, unitPrice: 1.005 },
        { name: 'B', qty: 2.675e-6, unitPrice: 1e6 },
      ],
    });
    expect(claim.rows.map((row: { amount: number }) => row.amount)).toEqual([1.01, 2.68]);
    expect(claim).toMatchObject({ total: 3.69, remainingAfter: 3596.31 });
    await expect(
      call('fill_claim_form', {
        ...claimInput,
        items: [{ name: 'A', qty: 2, unitPrice: Number.MAX_VALUE }],
      }),
    ).rejects.toMatchObject({ code: 'invalid_amount' });
  });

  it('submits a stored, in-budget claim for the same owner and uses the stored values', async () => {
    const owner = ctx({ ownerId: 't1', sessionID: 'first' });
    const sameOwner = ctx({ ownerId: 't1', sessionID: 'second' });
    const otherOwner = ctx({ ownerId: 't2', sessionID: 'first' });
    const claim = await call('fill_claim_form', claimInput, owner);
    const over = await call(
      'fill_claim_form',
      {
        ...claimInput,
        items: [{ name: 'A', qty: 1, unitPrice: 3600.005 }],
      },
      owner,
    );
    for (const [claimId, context, code] of [
      ['claim-unknown', owner, 'claim_not_found'],
      [claim.claimId, otherOwner, 'claim_not_found'],
      [over.claimId, owner, 'over_budget'],
    ] as const) {
      await expect(call('submit_for_approval', { claimId }, context)).rejects.toMatchObject({
        code,
      });
    }
    expect(approvals).toHaveLength(0);
    claim.total = 1;
    const a = await call(
      'submit_for_approval',
      { claimId: claim.claimId, note: 'ส่งตรวจ' },
      sameOwner,
    );
    expect(a).toMatchObject({ status: 'pending', from: 't1' });
    expect(approvals[0]).toMatchObject({
      status: 'pending',
      ownerId: 't1',
      claim: { claimId: claim.claimId, total: 1200 },
      note: 'ส่งตรวจ',
    });
    expect(await call('submit_for_approval', { claimId: claim.claimId }, owner)).toEqual(a);
    expect(approvals).toHaveLength(1);
  });

  it('lets a delegated session of the same teacher submit a claim and the principal read it', async () => {
    const { claimId } = await call(
      'fill_claim_form',
      claimInput,
      ctx({ sessionID: 'porn-session' }),
    );
    const sent = await call('submit_for_approval', { claimId }, ctx({ sessionID: 'porn-session' }));
    expect(sent).toMatchObject({ status: 'pending' });
    const pending = await call(
      'list_pending_approvals',
      {},
      ctx({ sessionID: 'principal-session' }),
    );
    expect(pending.count).toBe(1);
    expect(pending.items[0]).toMatchObject({ approvalId: sent.approvalId, claimId });
  });

  it('mails only the test mailbox', async () => {
    const m = await call('send_email', { to: 'someone@real.example', subject: 's', body: 'b' });
    expect(m.deliveredTo).toBe('test-mailbox');
    expect(testMailbox.at(-1)?.to).toBe('test-mailbox');
  });
});

describe('published order', () => {
  it('save_assessment returns the final order and key the form was built with', async () => {
    const real = publisher.publish;
    publisher.publish = async () => ({
      mode: 'mock',
      formId: 'f',
      url: 'https://example.invalid/f',
      questions: [{ text: 't', choices: ['a', 'b', 'c', 'd'], answerIndex: 2, points: 1 }],
    });
    try {
      const r = await call('save_assessment', sample);
      expect(r.questions[0]).toMatchObject({
        id: 'q1',
        choices: ['a', 'b', 'c', 'd'],
        answer: 'ค',
      });
    } finally {
      publisher.publish = real;
    }
  });
});

describe('curriculum_lookup queries', () => {
  it('matches any word and falls back to the grade instead of returning nothing', async () => {
    const some = await call('curriculum_lookup', {
      grade: 'ป.5',
      query: 'เศษส่วน การบวก การลบเศษส่วนและจำนวนคละ',
    });
    expect(some.count).toBeGreaterThan(0);
    const none = await call('curriculum_lookup', { grade: 'ป.5', query: 'ไม่มีคำนี้แน่นอน' });
    expect(none.count).toBeGreaterThan(0);
    expect(none.note).toContain('ทั้งชั้น');
    expect((await call('curriculum_lookup', { query: 'ไม่มีคำนี้แน่นอน' })).count).toBe(0);
  });
});

describe('answer spread through the real publisher', () => {
  it('moves keys the model put first so no position holds more than ceil(n/4)', async () => {
    const sent: { questions: { answerIndex: number }[] }[] = [];
    vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://bridge.invalid');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: unknown, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)));
        return Response.json({
          ok: true,
          formId: 'f_1',
          url: 'https://docs.google.com/forms/d/f_1/viewform',
        });
      }),
    );
    try {
      const allFirst = structuredClone(sample);
      for (const q of allFirst.questions) {
        const key = q.choices.find((c) => c.id === q.correctChoiceId)!;
        q.choices = [key, ...q.choices.filter((c) => c !== key)];
      }
      const r = await call('save_assessment', allFirst);
      const counts = [0, 0, 0, 0];
      for (const q of sent[0]!.questions) counts[q.answerIndex]!++;
      expect(Math.max(...counts)).toBeLessThanOrEqual(3);
      expect(r.questions.map((q: { answer: string }) => q.answer).join('')).toBe(
        sent[0]!.questions.map((q) => 'กขคง'[q.answerIndex]).join(''),
      );
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});

describe('indicator field', () => {
  it('accepts a listed indicator and rejects an invented one', async () => {
    const ok = structuredClone(sample);
    (ok.questions[0] as { indicator?: string }).indicator = 'ค 1.1 ป.5/3';
    expect((await call('check_assessment', ok)).ok).toBe(true);
    (ok.questions[0] as { indicator?: string }).indicator = 'ค 9.9 ป.5/9';
    const r = await call('check_assessment', ok);
    expect(r.ok).toBe(false);
    expect(r.errors.map((e: { code: string }) => e.code)).toContain('unknown_indicator');
  });
});
