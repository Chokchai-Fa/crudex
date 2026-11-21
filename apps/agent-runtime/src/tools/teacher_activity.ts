import { teacherActivityLog } from '../data/school';
import { sampleOwner } from '../data/sample';
import { activity } from '../state';
import { approvals } from './approval-store';
import type { ToolDefinition } from './types';

const submittedAction = 'ส่งเอกสารเบิกเข้ากล่องอนุมัติ';
const formAction = 'สร้างแบบทดสอบ Google Form';

/** Tools whose success counts as teacher work. Recorded by the plugin after the tool returns. */
export const activityActions: Readonly<Record<string, string>> = {
  save_assessment: formAction,
  fraction_addition_form: formAction,
  make_file: 'สร้างใบงานหรือไฟล์',
  make_slides: 'สร้างสไลด์',
  make_sheet: 'สร้างชีต',
};

const timeZone = 'Asia/Bangkok';
const dayOf = (at: number) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(at);

/** No names: the sample teacher keeps its sample label, a login account shows only its last 4 characters. */
function teacherLabel(ownerId: string) {
  return ownerId === sampleOwner ? 'ครูตัวอย่าง ก' : `ครูบัญชี …${ownerId.slice(-4)}`;
}

export function teacherActivitySummary(now = Date.now()) {
  const today = dayOf(now);
  const yesterday = dayOf(now - 86_400_000);
  const dateLabel = (at: number) => {
    const day = dayOf(at);
    return day === today ? 'วันนี้' : day === yesterday ? 'เมื่อวาน' : undefined;
  };
  const counts = new Map<
    string,
    { teacher: string; date: string; action: string; count: number }
  >();
  const add = (ownerId: string, action: string, at: number) => {
    const date = dateLabel(at);
    if (!date) return;
    const teacher = teacherLabel(ownerId);
    const key = [teacher, date, action].join('|');
    const entry = counts.get(key) ?? { teacher, date, action, count: 0 };
    entry.count++;
    counts.set(key, entry);
  };
  for (const item of activity) add(item.ownerId, item.action, item.at);
  for (const record of approvals) add(record.ownerId, submittedAction, record.submittedAt);

  // With no recorded tool work yet, show the sample Form/worksheet counts beside the real claims.
  const live = activity.some((item) => dateLabel(item.at));
  const entries = [...(live ? [] : teacherActivityLog), ...counts.values()];
  const byAction = new Map<string, number>();
  for (const entry of entries) {
    byAction.set(entry.action, (byAction.get(entry.action) ?? 0) + entry.count);
  }
  // One brief item in the design's words: "ครูใช้ crudex เมื่อวาน N คน ทำสื่อ M ชุด".
  const made = entries.filter((e) => e.date === 'เมื่อวาน' && e.action !== submittedAction);
  const teachers = new Set(made.map((e) => e.teacher)).size;
  const items = made.reduce((sum, e) => sum + e.count, 0);
  const briefLine = items
    ? `ครูใช้ crudex เมื่อวาน ${teachers} คน ทำสื่อ ${items} ชุด`
    : 'เมื่อวานยังไม่มีครูทำสื่อใน crudex';
  return {
    mode: live ? 'live' : 'sample',
    briefLine,
    label: live ? 'งานจริงในระบบ เมื่อวานและวันนี้ (เวลาไทย)' : 'ตัวอย่าง',
    entries,
    pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
    totals: [...byAction].map(([action, count]) => ({ action, count })),
  };
}

export const teacherActivity: ToolDefinition = {
  name: 'teacher_activity',
  description:
    'งานที่ครูทำในระบบเมื่อวานและวันนี้ (เวลาไทย) เช่น Form ใบงาน สไลด์ที่สร้าง และเอกสารที่ส่งเข้ากล่องอนุมัติ นับจากข้อมูลจริงในระบบ ถ้ายังไม่มีงานจริงจะใช้ข้อมูลตัวอย่างและ mode เป็น sample คืนจำนวนต่อครูและต่อประเภทงาน และ briefLine (ข้องานครูในสรุปเช้า ให้ใช้ตรงตัว) ไม่มีข้อมูลนักเรียน',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: () => teacherActivitySummary(),
};
