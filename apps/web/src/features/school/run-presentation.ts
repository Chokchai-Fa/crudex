import type { RunEvent, RunStatus } from '@repo/shared';
import { publicRunText } from './public-run-text';

// Only classroom-facing tasks get a specific label. Internal and unknown tools stay quiet.
const toolLabels = new Map([
  ['curriculum_lookup', 'กำลังดูหลักสูตร'],
  ['old_exam_search', 'กำลังค้นหาข้อสอบ'],
  ['check_assessment', 'กำลังตรวจคำตอบของใบงาน'],
  ['save_assessment', 'กำลังบันทึกใบงาน'],
  ['get_scores', 'กำลังอ่านคะแนน'],
  ['get_school_summary', 'กำลังอ่านข้อมูลโรงเรียน'],
  ['make_sheet', 'กำลังเตรียมตาราง'],
  ['make_file', 'กำลังเตรียมเอกสาร'],
  ['make_slides', 'กำลังเตรียมสไลด์'],
  ['fraction_addition_form', 'กำลังเตรียมฟอร์ม'],
  ['fill_claim_form', 'กำลังเตรียมใบเบิก'],
  ['read_budget', 'กำลังอ่านข้อมูลงบประมาณ'],
  ['get_approval', 'กำลังเปิดคำขออนุมัติ'],
  ['list_pending_approvals', 'กำลังอ่านคำขอที่รออนุมัติ'],
]);

const failureMessages = new Map([
  ['timeout', 'ผู้ช่วยตอบไม่ทันเวลา'],
  ['session_busy', 'ผู้ช่วยยังทำงานก่อนหน้าอยู่ กรุณารอสักครู่'],
  ['session_unavailable', 'ยังเปิดบทสนทนานี้ไม่ได้ กรุณาลองใหม่ภายหลัง'],
  ['capacity_exhausted', 'ระบบรับงานเต็มแล้ว กรุณาลองใหม่ภายหลัง'],
  ['turn_limit', 'ผู้ช่วยถึงขีดจำกัดของงานรอบนี้'],
  ['delegation_failed', 'ผู้ช่วยที่รับงานต่อทำงานไม่สำเร็จ'],
  ['interrupted', 'การตอบหยุดลงก่อนเสร็จ'],
  ['stream_closed', 'การตอบหยุดลงก่อนเสร็จ'],
  ['cancelled', 'ยกเลิกงานแล้ว'],
]);

export function presentRun(status: RunStatus, events: RunEvent[], complete: boolean) {
  let phase = status;
  let errorCode = '';
  let lastProposalId = '';
  let final = complete;
  const working = new Map<string, string>();
  const historyActive = status === 'queued' || status === 'running';

  for (const event of events) {
    switch (event.type) {
      case 'status':
        // A replay can start with old queue events even when history already knows the outcome.
        if (historyActive && (event.status !== 'queued' || phase === 'queued'))
          phase = event.status;
        break;
      case 'tool':
        if (event.status === 'started') {
          const label = toolLabels.get(event.name);
          if (label) working.set(event.id, label);
        } else working.delete(event.id);
        if (phase === 'queued') phase = 'running';
        break;
      case 'delta':
        if (phase === 'queued') phase = 'running';
        break;
      case 'approval':
        lastProposalId = event.proposalId;
        break;
      case 'error':
        final = true;
        errorCode = event.code;
        if (historyActive) phase = 'failed';
        break;
      case 'done':
        final = true;
        if (historyActive) phase = 'succeeded';
        break;
    }
  }
  const answer = publicRunText(events, final)
    .split(/\r?\n/)
    .filter(
      (line) =>
        !/^(?:ลิงก์:\s*\/play\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|mode:\s*school)$/i.test(
          line.trim(),
        ),
    )
    .join('\n')
    .trim();
  const activeTool = [...working.values()].at(-1);
  let activity = '';
  if (phase === 'queued') activity = 'รอคิว';
  if (phase === 'running' && !final) {
    if (activeTool) activity = activeTool;
    else if (!answer)
      activity = publicRunText(events, true).trim() ? 'กำลังเรียบเรียงคำตอบ' : 'กำลังคิด';
  }
  let notice = '';
  if (phase === 'cancelled') notice = 'ยกเลิกงานแล้ว';
  if (phase === 'interrupted') notice = 'การตอบหยุดลงก่อนเสร็จ';
  if (phase === 'failed') notice = failureMessages.get(errorCode) ?? 'ผู้ช่วยทำงานนี้ไม่สำเร็จ';
  return { answer, activity, notice, lastProposalId, final, phase };
}
