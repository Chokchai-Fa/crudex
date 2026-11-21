import { activities, briefTopicNames, schoolClasses } from '../data/school';
import { pendingApprovals, pendingLabel } from './list_pending_approvals';
import { thaiDate } from './server-clock';
import { scoreLabel } from '../lib/score-label';
import type { ToolDefinition } from './types';

const THRESHOLD_RATIO = 0.5;

export function schoolSummary(now = new Date()) {
  const classes = schoolClasses.map(({ topics, ...c }) => {
    const meanBelow = c.mean < c.maxScore * THRESHOLD_RATIO;
    const weakTopics = (topics ?? [])
      .filter((t) => t.correctRate < THRESHOLD_RATIO)
      .map((t) => ({
        topic: t.topic,
        correctPercent: Math.round(t.correctRate * 1000) / 10,
        correctLabel: `ตอบถูก ${t.correct}/${t.total} ข้อ (${Math.round(t.correctRate * 1000) / 10}%)`,
      }));
    return {
      ...c,
      meanLabel: `${c.mean}/${c.maxScore} คะแนน`,
      // Class totals are rebuilt from the class mean, so they are rounded to whole points.
      scoreLabel: scoreLabel({ total: Math.round(c.mean * c.n), n: c.n, maxScore: c.maxScore }),
      // A room is below the line when its mean, or any topic of its latest assessment, is under 50%.
      belowThreshold: meanBelow || weakTopics.length > 0,
      belowThresholdReason: meanBelow
        ? `ค่าเฉลี่ยห้องต่ำกว่า 50%`
        : weakTopics.length
          ? `หัวข้อ${weakTopics.map((t) => ` ${t.topic} ${t.correctLabel}`).join(',')} ต่ำกว่า 50%`
          : undefined,
      weakTopics,
      meanPercent: Math.round((c.mean / c.maxScore) * 100),
    };
  });
  const flagged = classes.filter((c) => c.belowThreshold);
  const briefClassLine = flagged.length
    ? flagged
        .map((c) =>
          c.mean < c.maxScore * THRESHOLD_RATIO
            ? `${c.label} เฉลี่ย ${c.mean}/${c.maxScore} (${c.meanPercent}%) ต่ำกว่าเกณฑ์ 50%`
            : `${c.label} เฉลี่ย ${c.mean}/${c.maxScore} (${c.meanPercent}%) แต่${c.weakTopics
                .map(
                  (t) => `หัวข้อ${briefTopicNames[t.topic] ?? t.topic}ถูกแค่ ${t.correctPercent}%`,
                )
                .join(' และ')} ต่ำกว่าเกณฑ์ 50%`,
        )
        .join('; ')
    : 'ไม่มีห้องหรือหัวข้อที่ต่ำกว่าเกณฑ์ 50%';
  const budget = activities.reduce((sum, a) => sum + a.budget, 0);
  const spent = activities.reduce((sum, a) => sum + a.spent, 0);
  return {
    mode: 'mock',
    label: 'ตัวอย่าง',
    date: thaiDate(now),
    // Same box as list_pending_approvals and teacher_activity.
    pendingApprovals: pendingApprovals().length,
    pendingApprovalsLabel: pendingLabel(pendingApprovals().length),
    thresholdRatio: THRESHOLD_RATIO,
    classes,
    // Line 2 of the morning brief, worded by code: only a room whose mean is under 50% is called below the bar.
    briefTitle: `สรุปเช้าวัน${thaiDate(now).weekday}`,
    briefClassLine,
    flaggedClasses: classes.filter((c) => c.belowThreshold).map((c) => c.label),
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
    'สรุปข้อมูลโรงเรียนระดับห้องและระดับกิจกรรม (ตัวจำลอง: ข้อมูลตัวอย่าง) คืนวันที่วันนี้แบบ พ.ศ. (date.thai) จำนวนเอกสารรออนุมัติในกล่องจริง (pendingApprovals และ pendingApprovalsLabel ให้ใช้ตรงตัว) ค่าเฉลี่ยรายห้องพร้อมหน่วย (meanLabel และ scoreLabel ให้ใช้ตรงตัว) ห้องที่ต่ำกว่าเกณฑ์ (flaggedClasses: ค่าเฉลี่ยห้องหรือหัวข้อใดหัวข้อหนึ่งได้ต่ำกว่า 50% ระบบกำหนด เหตุผลอยู่ใน belowThresholdReason; หัวสรุปเช้าให้ใช้ briefTitle และข้อผลเรียนให้ใช้ briefClassLine ตรงตัว) และงบรวมกับกิจกรรมที่ใกล้เต็ม ไม่มีข้อมูลรายคน ตัวเลขคำนวณโดยระบบ',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => schoolSummary(),
};
