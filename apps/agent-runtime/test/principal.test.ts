import { beforeEach, describe, expect, it } from 'vitest';
import { principalAgents } from '../src/agents';
import { decide, permissionsFor } from '../src/permissions';
import { tools } from '../src/tools';
import {
  addApproval,
  notifications,
  resetApprovals,
  type ClaimSnapshot,
} from '../src/tools/approval-store';
import type { ToolContext } from '../src/tools/types';

const ctx: ToolContext = { count: 1, signal: new AbortController().signal };
const call = async (name: string, input: unknown = {}) => {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error('missing ' + name);
  return (await tool.execute(input, ctx)) as Record<string, unknown> & { items?: unknown[] };
};
const [rungchao, lekha] = principalAgents;

const claim = (overrides: Partial<ClaimSnapshot> = {}): ClaimSnapshot => ({
  claimId: 'claim-1',
  label: 'ตัวอย่าง',
  date: '21 พฤศจิกายน 2569',
  budgetCode: 'A24',
  purpose: 'ซื้ออุปกรณ์ค่ายคณิตศาสตร์',
  rows: [{ name: 'กระดาษ', qty: 10, unitPrice: 120, amount: 1200 }],
  total: 1200,
  remainingAfter: 1300,
  overBudget: false,
  ...overrides,
});

beforeEach(() => resetApprovals());

describe('principal agents', () => {
  it('are two primary agents without subagents', () => {
    expect(principalAgents.map((a) => a.id)).toEqual(['rungchao', 'lekha_por']);
    for (const agent of principalAgents) {
      expect(agent.mode).toBe('primary');
      expect(agent.subagents).toEqual([]);
      const rules = permissionsFor(agent);
      for (const action of [
        'subagent',
        'shell',
        'edit',
        'webfetch',
        'get_scores',
        'send_email',
        'save_assessment',
      ]) {
        expect(decide(rules, action, ['jum']), `${agent.id}:${action}`).toBe('deny');
      }
    }
  });

  it('use the display names the principal chose', () => {
    expect(rungchao?.name).not.toBe(lekha?.name);
    expect(rungchao?.name).toBe('รุ่งเช้า');
    expect(lekha?.name).toBe('ลุงนิต');
    expect(rungchao?.instructions).toContain('คุณคือรุ่งเช้า');
    expect(lekha?.instructions).toContain('คุณคือลุงนิต');
  });

  it('bind exactly the tools in the spec', () => {
    expect([...(rungchao?.tools ?? [])].sort()).toEqual(
      [
        'get_school_summary',
        'list_pending_approvals',
        'memory_search',
        'publish_brief',
        'read_budget',
        'teacher_activity',
      ].sort(),
    );
    expect([...(lekha?.tools ?? [])].sort()).toEqual(
      [
        'decide_approval',
        'get_approval',
        'get_school_summary',
        'list_pending_approvals',
        'memory_search',
        'memory_save',
        'read_budget',
      ].sort(),
    );
    expect(rungchao?.skills).toEqual(['morning-brief']);
    expect(lekha?.skills).toEqual(['approval-desk']);
  });

  it('makes the principal confirm every decision', () => {
    expect(decide(permissionsFor(lekha as never), 'decide_approval', ['*'])).toBe('ask');
    expect(rungchao?.tools).not.toContain('decide_approval');
  });

  it('keeps the 7-line brief order in the instructions', () => {
    const text = rungchao?.instructions ?? '';
    expect(text).toContain('ไม่เกิน 7 บรรทัด');
    expect(text.indexOf('get_school_summary')).toBeLessThan(text.indexOf('list_pending_approvals'));
    expect(text.indexOf('list_pending_approvals')).toBeLessThan(text.indexOf('teacher_activity'));
  });
});

describe('school data stays above the student level', () => {
  it('carries no student identifier in the summary, activity or budget views', async () => {
    for (const name of ['get_school_summary', 'teacher_activity', 'read_budget']) {
      const text = JSON.stringify(await call(name));
      expect(text, name).not.toMatch(/นักเรียนตัวอย่าง|studentId|"s-\d\d"|displayName/);
    }
  });

  it('flags classes below half of the full score and names the lowest', async () => {
    const r = (await call('get_school_summary')) as {
      classes: { label: string; belowThreshold: boolean }[];
      lowestClass: string;
      budget: { nearLimit: { code: string }[] };
    };
    expect(r.classes.filter((c) => c.belowThreshold).map((c) => c.label)).toEqual(['ป.6/1']);
    expect(r.lowestClass).toBe('ป.6/1');
    expect(r.budget.nearLimit.map((a) => a.code)).toEqual(['A24', 'A07']);
  });
});

describe('approval desk', () => {
  it('lists, reads with code-found anomalies, and records the decision with notifications', async () => {
    const bad = addApproval(
      'teacher-a',
      claim({ overBudget: true, remainingAfter: -500, date: '' }),
      'ด่วน',
    );
    addApproval('teacher-b', claim({ claimId: 'claim-2' }), '');
    expect((await call('list_pending_approvals')).count).toBe(2);

    const read = (await call('get_approval', { approvalId: bad.id })) as {
      anomalies: { code: string }[];
    };
    expect(read.anomalies.map((a) => a.code)).toEqual(
      expect.arrayContaining(['over_budget', 'missing_date']),
    );

    await expect(
      call('decide_approval', { approvalId: bad.id, decision: 'return' }),
    ).rejects.toMatchObject({ code: 'reason_required' });
    expect(
      await call('decide_approval', { approvalId: bad.id, decision: 'return', reason: 'เกินงบ' }),
    ).toMatchObject({ status: 'returned', notified: ['porn', 'teacher-a'] });
    expect(notifications.map((n) => n.to)).toEqual(['porn', 'teacher-a']);
    expect(notifications[0]?.text).toContain('เกินงบ');
    expect((await call('list_pending_approvals')).count).toBe(1);
    await expect(
      call('decide_approval', { approvalId: bad.id, decision: 'approve' }),
    ).rejects.toMatchObject({ code: 'already_decided' });
    await expect(call('get_approval', { approvalId: 'nope' })).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('reports a clean claim with no anomalies', async () => {
    const ok = addApproval('teacher-a', claim(), '');
    expect(
      ((await call('get_approval', { approvalId: ok.id })) as { anomalies: unknown[] }).anomalies,
    ).toEqual([]);
  });
});

describe('publish_brief', () => {
  const brief = [
    'สรุปเช้า (ตัวอย่าง)',
    'ผลเรียน: ป.6/1 ต่ำกว่าเกณฑ์ ค่าเฉลี่ย 4.6/10',
    'งบ: ใช้ไป 56% กิจกรรม A24 ใกล้เต็ม',
    'เอกสารรออนุมัติ: 2 ฉบับ',
    'งานครูเมื่อวาน: ใบงาน 2 ฉบับ',
    'ต้องตัดสินใจ: อนุมัติเบิกค่ายคณิตศาสตร์',
  ].join('\n');

  it('is bound only to rungchao and accepts a clean brief of at most 7 lines', async () => {
    expect(rungchao?.tools).toContain('publish_brief');
    expect(lekha?.tools).not.toContain('publish_brief');
    expect(await call('publish_brief', { text: brief })).toMatchObject({ lines: 6 });
  });

  it('rejects an 8-line brief and any student name, code or number', async () => {
    await expect(
      call('publish_brief', { text: Array(8).fill('บรรทัด').join('\n') }),
    ).rejects.toMatchObject({ code: 'brief_rejected' });
    for (const leak of ['นักเรียนตัวอย่าง 07 ต้องติว', 'รหัส s-07', 'เลขที่ 12 ขาดเรียน']) {
      await expect(call('publish_brief', { text: leak })).rejects.toMatchObject({
        code: 'brief_rejected',
      });
    }
    await expect(call('publish_brief', { text: '   ' })).rejects.toMatchObject({
      code: 'brief_rejected',
    });
  });
});
