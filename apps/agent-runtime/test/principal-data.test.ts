import { beforeEach, describe, expect, it } from 'vitest';
import { schoolSummary } from '../src/tools/get_school_summary';
import { tools } from '../src/tools';
import { addApproval, resetApprovals, type ClaimSnapshot } from '../src/tools/approval-store';
import { thaiDate } from '../src/tools/server-clock';

const context = { count: 1, signal: new AbortController().signal };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (name: string, input: unknown = {}): Promise<Record<string, any>> => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error('missing ' + name);
  return (await tool.execute(input, context)) as Record<string, unknown>;
};
const claim: ClaimSnapshot = {
  claimId: 'claim-1',
  label: 'ตัวอย่าง',
  date: '1 พฤศจิกายน 2569',
  budgetCode: 'A24',
  purpose: 'กระดาษกราฟ',
  rows: [{ name: 'กระดาษ', qty: 2, unitPrice: 5, amount: 10 }],
  total: 10,
  remainingAfter: 50,
  overBudget: false,
};

beforeEach(() => resetApprovals());

describe('principal brief data', () => {
  it('stamps today as a Buddhist-era date in Bangkok', () => {
    // 2026-11-20T18:30Z is already 21 Nov in Bangkok.
    expect(thaiDate(new Date('2026-11-20T18:30:00Z'))).toEqual({
      thai: '21 พฤศจิกายน 2569',
      iso: '2026-11-21',
    });
    expect(schoolSummary(new Date('2026-11-20T18:30:00Z')).date.thai).toBe('21 พฤศจิกายน 2569');
  });

  it('summary, approval list and teacher activity read the same approval box', async () => {
    const empty = await call('teacher_activity');
    expect((await call('get_school_summary')).pendingApprovals).toBe(0);
    expect(empty.pendingApprovals).toBe(0);
    expect(JSON.stringify(empty.totals)).not.toContain('ส่งเอกสารเบิก');
    expect(empty.mode).toBe('sample');

    addApproval('teacher-a', claim, '');
    addApproval('teacher-b', { ...claim, claimId: 'claim-2' }, '');
    const listed = (await call('list_pending_approvals')).count;
    expect(listed).toBe(2);
    expect((await call('get_school_summary')).pendingApprovals).toBe(listed);
    const activity = await call('teacher_activity');
    expect(activity.pendingApprovals).toBe(listed);
    expect(activity.totals).toContainEqual({ action: 'ส่งเอกสารเบิกเข้ากล่องอนุมัติ', count: 2 });
  });

  it('shows ม.2/1 on the principal side with the same numbers as the teacher side', async () => {
    const summary = await call('get_school_summary');
    const m2 = summary.classes.find((c: { label: string }) => c.label === 'ม.2/1');
    const teacherSide = await call('get_scores', { classLabel: 'ม.2/1' });
    expect(m2).toMatchObject({
      n: teacherSide.n,
      mean: teacherSide.mean,
      maxScore: teacherSide.maxScore,
      meanLabel: '3.5/6 คะแนน',
      scoreLabel: '28/48 คะแนน (8 คน คนละ 6 คะแนน) เฉลี่ย 3.5/6',
      belowThreshold: true,
    });
    expect(JSON.stringify(summary)).not.toMatch(/นักเรียนตัวอย่าง|studentId/);
  });

  it('get_scores labels every mean with its full score', async () => {
    const r = await call('get_scores', { classLabel: 'ม.2/1' });
    expect(r.meanLabel).toBe('3.5/6 คะแนน');
    expect(r.scoreLabel).toBe('28/48 คะแนน (8 คน คนละ 6 คะแนน) เฉลี่ย 3.5/6');
    const p5 = await call('get_scores', { classLabel: 'ป.5/2' });
    expect(p5.scoreLabel).toBe('136/200 คะแนน (20 คน คนละ 10 คะแนน) เฉลี่ย 6.8/10');
    for (const h of r.history) {
      expect(h.meanLabel).toBe(`${h.mean}/${h.maxScore} คะแนน`);
      expect(h.scoreLabel).toContain(
        `(${h.n} คน คนละ ${h.maxScore} คะแนน) เฉลี่ย ${h.mean}/${h.maxScore}`,
      );
    }
  });
});
