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

describe('the brief never calls a room at or above 50% below the bar', () => {
  it('code writes line 2 as a topic problem for ม.2/1', () => {
    expect(schoolSummary().briefClassLine).toBe(
      'ม.2/1 เฉลี่ย 3.5/6 (58%) แต่หัวข้อการนำพีทาโกรัสไปใช้ในชีวิตจริงถูกแค่ 37.5% ต่ำกว่าเกณฑ์ 50%',
    );
  });

  it('publish_brief rejects calling ม.2/1 below the bar and accepts the code line', async () => {
    const reject = [
      '1. ผลเรียนต่ำกว่าเกณฑ์: ม.2/1 ค่าเฉลี่ย 3.5/6',
      '1. ม.2/1 ต่ำกว่าเกณฑ์ เฉลี่ย 3.5/6',
      '1. ห้องต่ำกว่าเกณฑ์: ม.2/1 เพราะหัวข้อพีทาโกรัส',
    ];
    for (const line of reject) {
      await expect(
        call('publish_brief', { text: 'สรุปเช้าวันเสาร์\n' + line }),
      ).rejects.toMatchObject({
        code: 'brief_rejected',
        message: expect.stringContaining('room_not_below (บรรทัด 2)'),
      });
    }
    const text = 'สรุปเช้าวันเสาร์\n1. ' + schoolSummary().briefClassLine;
    expect(await call('publish_brief', { text })).toMatchObject({ lines: 2 });
  });
});

describe('brief follows the 09-principal-brief design', () => {
  const summaryAt = schoolSummary(new Date('2026-11-21T00:00:00Z'));
  it('code gives the title, the teacher line and the room line', () => {
    expect(summaryAt.briefTitle).toBe('สรุปเช้าวันเสาร์');
    expect(teacherActivitySummary(Date.parse('2026-11-21T07:00:00Z')).briefLine).toBe(
      'ครูใช้ crudex เมื่อวาน 1 คน ทำสื่อ 3 ชุด',
    );
  });

  it('rejects a brief without the title or with unnumbered items', async () => {
    for (const text of [
      'วันที่ 21 พฤศจิกายน 2569\n1. งบใช้ไป 73.4%',
      'สรุปเช้าวันเสาร์\nงบใช้ไป 73.4%',
      'สรุปเช้าวันเสาร์\n1. งบใช้ไป 73.4%\n3. เอกสารรออนุมัติ 1 รายการ',
    ]) {
      await expect(call('publish_brief', { text })).rejects.toMatchObject({
        message: expect.stringContaining('format'),
      });
    }
  });
});

describe('school app shares the same sample flagged rooms', () => {
  it('packages/shared sampleFlaggedClasses equals get_school_summary', async () => {
    const { sampleFlaggedClasses } =
      await import('../../../packages/shared/src/morning-brief.schema');
    const summary = schoolSummary();
    expect(sampleFlaggedClasses.map((c) => c.line).join('; ')).toBe(summary.briefClassLine);
    for (const shared of sampleFlaggedClasses) {
      const c = summary.classes.find((k) => k.label === shared.label)!;
      expect(c).toMatchObject({
        mean: shared.mean,
        maxScore: shared.maxScore,
        meanPercent: shared.meanPercent,
      });
      expect(c.weakTopics.map((t) => t.correctPercent)).toEqual(
        shared.weakTopics.map((t) => t.correctPercent),
      );
      expect(c.meanLabel).toBe(shared.meanLabel);
    }
  });
});

describe('school backend seeds the same ม.2/1 sample history', () => {
  it('packages/shared sampleClassM21 equals the runtime rows', async () => {
    const { sampleClassM21 } = await import('../../../packages/shared/src/sample-class');
    const { pastAssessments } = await import('../src/data/class-score-history');
    const runtime = pastAssessments['class-m2-1'] ?? [];
    expect(
      sampleClassM21.assessments.map(({ date, title, questionTopics, results }) => ({
        date,
        title,
        questionTopics,
        results,
      })),
    ).toEqual(
      runtime.map(({ date, assessment, questionTopics, results }) => ({
        date,
        title: assessment.title,
        questionTopics: [...questionTopics],
        results: [...results],
      })),
    );
  });
});
