import type { AgentId, RunEvent, RunStatus } from '@repo/shared';
import { publicRunText } from './public-run-text';

// Only classroom-facing tasks get a specific label. Internal and unknown tools stay quiet.
const toolLabels = new Map([
  ['subagent', 'กำลังประสานผู้ช่วย'],
  ['search_proj14', 'กำลังค้นหาสื่อการสอน'],
  ['teacher_activity', 'กำลังอ่านกิจกรรมของครู'],
  ['crudex_kahoot_create_or_update_kahoot', 'กำลังจัดทำควิซ Kahoot'],
  ['calc', 'กำลังคำนวณ'],
  ['submit_for_approval', 'กำลังเตรียมคำขออนุมัติ'],
  ['decide_approval', 'กำลังบันทึกผลการพิจารณา'],
  ['publish_brief', 'กำลังตรวจสรุปเช้า'],
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

type ActivityKind = 'queued' | 'thinking' | 'tool' | 'handoff' | 'writing';

export type AgentNames = ReadonlyArray<{ id: AgentId; name: string }>;

export function presentRun(
  status: RunStatus,
  events: RunEvent[],
  complete: boolean,
  agents?: AgentNames,
) {
  let phase = status;
  let errorCode = '';
  let lastProposalId = '';
  let final = complete;
  const working = new Map<string, Extract<RunEvent, { type: 'tool' }>>();
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
          if (toolLabels.has(event.name)) working.set(event.id, event);
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
  let activityKind: ActivityKind | undefined;
  if (!final && phase === 'queued') {
    activityKind = 'queued';
    activity = 'รอคิว';
  } else if (!final && phase === 'running') {
    if (activeTool) {
      activityKind = activeTool.name === 'subagent' ? 'handoff' : 'tool';
      const delegate =
        activityKind === 'handoff' && agents?.find((a) => a.id === activeTool.agentId);
      activity = delegate ? 'กำลังประสานงานกับ' + delegate.name : toolLabels.get(activeTool.name)!;
    } else if (answer || publicRunText(events, true).trim()) {
      activityKind = 'writing';
      activity = 'กำลังเรียบเรียงคำตอบ';
    } else {
      activityKind = 'thinking';
      activity = 'กำลังคิด';
    }
  }
  let notice = '';
  if (phase === 'cancelled') notice = 'ยกเลิกงานแล้ว';
  if (phase === 'interrupted') notice = 'การตอบหยุดลงก่อนเสร็จ';
  if (phase === 'failed') notice = failureMessages.get(errorCode) ?? 'ผู้ช่วยทำงานนี้ไม่สำเร็จ';
  return { answer, activity, activityKind, notice, lastProposalId, final, phase };
}
