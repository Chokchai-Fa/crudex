import { decideApproval } from './decide_approval';
import { getApproval } from './get_approval';
import { getSchoolSummary } from './get_school_summary';
import { listPendingApprovals } from './list_pending_approvals';
import { teacherActivity } from './teacher_activity';
import { calc } from './calc';
import { checkAssessmentTool } from './check_assessment';
import { curriculumLookup } from './curriculum_lookup';
import { fillClaimForm } from './fill_claim_form';
import { getScores } from './get_scores';
import { makeFile } from './make_file';
import { makeSheet } from './make_sheet';
import { makeSlides } from './make_slides';
import { memorySave } from './memory_save';
import { memorySearch } from './memory_search';
import { oldExamSearch } from './old_exam_search';
import { readBudget } from './read_budget';
import { restrictedProbe } from './restricted-probe';
import { saveAssessment } from './save_assessment';
import { schoolTheme } from './school_theme';
import { searchProj14 } from './search_proj14';
import { sendEmail } from './send_email';
import { serverClock } from './server-clock';
import { submitForApproval } from './submit_for_approval';
import { taskStatus } from './task_status';

export const tools = [
  serverClock,
  restrictedProbe,
  memorySearch,
  memorySave,
  taskStatus,
  curriculumLookup,
  oldExamSearch,
  checkAssessmentTool,
  saveAssessment,
  makeFile,
  searchProj14,
  makeSlides,
  makeSheet,
  schoolTheme,
  readBudget,
  calc,
  fillClaimForm,
  submitForApproval,
  sendEmail,
  getScores,
  getSchoolSummary,
  teacherActivity,
  listPendingApprovals,
  getApproval,
  decideApproval,
];
