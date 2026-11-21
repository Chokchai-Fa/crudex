import { beforeEach, describe, expect, it } from 'vitest';
import { sampleClaimId } from '../src/data/sample-claim';
import { activity, exportState, importState, recordActivity } from '../src/state';
import { schoolSummary } from '../src/tools/get_school_summary';
import { tools } from '../src/tools';
import { approvals, seedSampleClaim } from '../src/tools/approval-store';
import { teacherActivitySummary } from '../src/tools/teacher_activity';

const empty = { version: 1, memory: {}, approvals: [], notifications: [], briefs: [] };
const context = { count: 1, signal: new AbortController().signal };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const call = async (name: string, input: unknown = {}): Promise<Record<string, any>> =>
  (await tools.find((t) => t.name === name)!.execute(input, context)) as Record<string, unknown>;

beforeEach(() => importState(empty));

describe('one demo story: ม.2/1 on the teacher side is the principal headline', () => {
  it('flags only ม.2/1, by its weak topic, with numbers equal to the teacher side', async () => {
    const summary = schoolSummary();
    expect(summary.flaggedClasses).toEqual(['ม.2/1']);
    expect(summary.lowestClass).toBe('ม.2/1');
    const m2 = summary.classes.find((c) => c.label === 'ม.2/1')!;
    const teacher = await call('get_scores', { classLabel: 'ม.2/1' });
    expect(m2).toMatchObject({ n: teacher.n, mean: teacher.mean, maxScore: teacher.maxScore });
    expect(m2.belowThresholdReason).toContain(
      'การนำความรู้เกี่ยวกับทฤษฎีบทพีทาโกรัสและบทกลับไปใช้ในชีวิตจริง ตอบถูก 9/24 ข้อ (37.5%)',
    );
    expect(summary.classes.find((c) => c.label === 'ป.6/1')?.belowThreshold).toBe(false);
    expect(JSON.stringify(summary)).not.toMatch(/นักเรียนตัวอย่าง|studentId|"s-\d\d"/);
  });

  it('seeds exactly one sample claim from ป้าพร and never a second one on restart', async () => {
    expect(seedSampleClaim()).toBe(true);
    expect(seedSampleClaim()).toBe(false);
    expect((await call('list_pending_approvals')).count).toBe(1);
    expect(schoolSummary().pendingApprovals).toBe(1);
    expect(schoolSummary().pendingApprovalsLabel).toBe('เอกสารรออนุมัติ 1 รายการ');
    expect((await call('list_pending_approvals')).countLabel).toBe('เอกสารรออนุมัติ 1 รายการ');
    expect(approvals[0]).toMatchObject({
      id: sampleClaimId,
      claim: { overBudget: false, total: 750, remainingAfter: 5150 },
    });
    expect(approvals[0]?.claim.label).toMatch(/^ตัวอย่าง/);
    const anomalies = (await call('get_approval', { approvalId: sampleClaimId })).anomalies;
    expect(anomalies).toEqual([]);

    // Restart: the gateway restores the snapshot, then the server seeds again.
    const snapshot = JSON.parse(JSON.stringify(exportState()));
    importState(empty);
    importState(snapshot);
    seedSampleClaim();
    expect(approvals.map((a) => a.id)).toEqual([sampleClaimId]);
  });

  it('keeps a decided sample claim instead of re-adding it', () => {
    seedSampleClaim();
    approvals[0]!.status = 'approved';
    expect(seedSampleClaim()).toBe(false);
    expect(approvals).toHaveLength(1);
  });

  it('teacher_activity counts real work for yesterday and today in Thai time', () => {
    const now = Date.parse('2026-11-21T07:00:00Z'); // 14:00 Bangkok
    seedSampleClaim(now);
    let r = teacherActivitySummary(now);
    expect(r.mode).toBe('sample');
    expect(r.totals).toContainEqual({ action: 'ส่งเอกสารเบิกเข้ากล่องอนุมัติ', count: 1 });

    recordActivity('teacher-demo', 'สร้างแบบทดสอบ Google Form', now - 3_600_000);
    recordActivity('teacher-demo', 'สร้างแบบทดสอบ Google Form', Date.parse('2026-11-20T16:59:00Z')); // 23:59 yesterday
    recordActivity('teacher-demo', 'สร้างใบงานหรือไฟล์', Date.parse('2026-11-19T10:00:00Z')); // too old
    r = teacherActivitySummary(now);
    expect(r.mode).toBe('live');
    expect(r.entries).toEqual(
      expect.arrayContaining([
        { teacher: 'ครูตัวอย่าง ก', date: 'วันนี้', action: 'สร้างแบบทดสอบ Google Form', count: 1 },
        {
          teacher: 'ครูตัวอย่าง ก',
          date: 'เมื่อวาน',
          action: 'สร้างแบบทดสอบ Google Form',
          count: 1,
        },
        {
          teacher: 'ครูตัวอย่าง ก',
          date: 'วันนี้',
          action: 'ส่งเอกสารเบิกเข้ากล่องอนุมัติ',
          count: 1,
        },
      ]),
    );
    expect(JSON.stringify(r)).not.toContain('สร้างใบงานหรือไฟล์');
    expect(activity).toHaveLength(3);
  });
});
