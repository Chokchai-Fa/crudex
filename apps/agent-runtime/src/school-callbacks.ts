/** Tools that call the school API in school mode, with the descriptions the model sees. The gateway's OpenAI backend uses the same text. */
export const schoolCallbacks: Record<string, string> = {
  memory_save: 'เสนอข้อความให้เจ้าของบัญชีอนุมัติ ก่อนเก็บเป็นความจำถาวร',
  memory_search: 'ค้นข้อความที่เจ้าของบัญชีอนุมัติให้จำแล้ว',
  get_scores: 'อ่านคะแนนและคะแนนเต็มที่บันทึกในห้องที่เลือก',
  get_school_summary: 'อ่านยอดรวมห้อง นักเรียน คะแนน และรายงานของโรงเรียน',
  teacher_activity: 'อ่านจำนวนงานที่เสร็จและใบงานที่สร้างในวันก่อนหน้า',
  list_pending_approvals: 'อ่านคำขอที่รอการอนุมัติของโรงเรียน',
  get_approval: 'อ่านรายละเอียดคำขอในโรงเรียนตามรหัส',
};
