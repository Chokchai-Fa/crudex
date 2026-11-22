import { ToolError } from '../../tools/identity';

export const MAX_SHOTS = 12;
export const MIN_SHOTS = 10;
export const MAX_CLIPS_PER_TEACHER_PER_DAY = 5;
export const MAX_CLIPS_PER_DAY = 20;
export const MAX_DRAFTS_PER_TEACHER_PER_DAY = 15;

const bangkokDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  dateStyle: 'short',
});
let clock = Date.now;
let currentDay = '';
let counts = freshCounts();

function freshCounts() {
  return { clips: 0, byTeacher: new Map<string, number>(), drafts: new Map<string, number>() };
}

export function lessonVideoNow() {
  return clock();
}

export function resetLimits(now = Date.now) {
  clock = now;
  currentDay = '';
  counts = freshCounts();
}

function today() {
  const day = bangkokDay.format(lessonVideoNow());
  if (day !== currentDay) {
    currentDay = day;
    counts = freshCounts();
  }
  return counts;
}

export function reserve(ownerId: string) {
  const day = today();
  const used = day.byTeacher.get(ownerId) ?? 0;
  if (used >= MAX_CLIPS_PER_TEACHER_PER_DAY) {
    throw new ToolError('clip_limit_reached', 'ครูสร้างครบ 5 คลิปต่อวันแล้ว');
  }
  if (day.clips >= MAX_CLIPS_PER_DAY) {
    throw new ToolError('clip_limit_reached', 'ทั้งระบบสร้างครบ 20 คลิปต่อวันแล้ว');
  }
  day.clips++;
  day.byTeacher.set(ownerId, used + 1);
  // Keep the original day's counts if the request crosses midnight.
  return () => release(ownerId, day);
}

export function release(ownerId: string, day = today()) {
  const used = day.byTeacher.get(ownerId) ?? 0;
  if (used === 0) return;
  day.byTeacher.set(ownerId, used - 1);
  day.clips--;
}

export function reserveDraft(ownerId: string) {
  const { drafts } = today();
  const used = drafts.get(ownerId) ?? 0;
  if (used >= MAX_DRAFTS_PER_TEACHER_PER_DAY) {
    throw new ToolError('draft_limit_reached', 'ครูร่างบทครบ 15 บทต่อวันแล้ว');
  }
  drafts.set(ownerId, used + 1);
  return () => drafts.set(ownerId, (drafts.get(ownerId) ?? 1) - 1);
}
