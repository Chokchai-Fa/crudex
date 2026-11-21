import { activities, schoolClasses } from '../data/school';
import { pendingApprovals } from './list_pending_approvals';
import { thaiDate } from './server-clock';
import { scoreLabel } from '../lib/score-label';
import type { ToolDefinition } from './types';

const THRESHOLD_RATIO = 0.5;

export function schoolSummary(now = new Date()) {
  const classes = schoolClasses.map((c) => ({
    ...c,
    meanLabel: `${c.mean}/${c.maxScore} คะแนน`,
    // Class totals are rebuilt from the class mean, so they are rounded to whole points.
    scoreLabel: scoreLabel({ total: Math.round(c.mean * c.n), n: c.n, maxScore: c.maxScore }),
    belowThreshold: c.mean < c.maxScore * THRESHOLD_RATIO,
  }));
  const budget = activities.reduce((sum, a) => sum + a.budget, 0);
  const spent = activities.reduce((sum, a) => sum + a.spent, 0);
  return {
    mode: 'mock',
    label: 'ตัวอย่าง',
    date: thaiDate(now),
    // Same box as list_pending_approvals and teacher_activity.
    pendingApprovals: pendingApprovals().length,
    thresholdRatio: THRESHOLD_RATIO,
    classes,
    lowestClass: [...classes].sort((a, b) => a.mean / a.maxScore - b.mean / b.maxScore)[0]?.label,
    budget: {
      total: budget,
      spent,
      spentPercent: Math.round((spent / budget) * 1000) / 10,
      nearLimit: activities
        .filter((a) => a.spent / a.budget >= 0.9)
        .map((a) => ({
          code: a.code,
          name: a.name,
          remaining: a.budget - a.spent,
          spentPercent: Math.round((a.spent / a.budget) * 1000) / 10,
        })),
    },
  };
}

export const getSchoolSummary: ToolDefinition = {
  name: 'get_school_summary',
  description:
    'สรุปข้อมูลโรงเรียนระดับห้องและระดับกิจกรรม (ตัวจำลอง: ข้อมูลตัวอย่าง) คืนวันที่วันนี้แบบ พ.ศ. (date.thai) จำนวนเอกสารรออนุมัติในกล่องจริง (pendingApprovals) ค่าเฉลี่ยรายห้องพร้อมหน่วย (meanLabel และ scoreLabel ให้ใช้ตรงตัว) ห้องที่ต่ำกว่าเกณฑ์ (ต่ำกว่า 50% ของคะแนนเต็ม ระบบกำหนด) และงบรวมกับกิจกรรมที่ใกล้เต็ม ไม่มีข้อมูลรายคน ตัวเลขคำนวณโดยระบบ',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => schoolSummary(),
};
