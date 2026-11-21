type BriefError = {
  code: 'too_many_lines' | 'student_ref' | 'empty';
  message: string;
  line?: number;
};

const studentReference = /\bs-\d+\b|นักเรียนตัวอย่าง\s*\d+|เลขที่\s*\d+/u;

export function checkBrief(
  text: string,
  opts?: { maxLines?: number; names?: string[] },
): { ok: boolean; errors: BriefError[] } {
  const maxLines = opts?.maxLines ?? 7;
  const lines = text.split(/\r\n|[\n\r\u2028\u2029]/u);
  const lineCount = lines.filter((line) => line.trim().length > 0).length;
  if (lineCount === 0) {
    return { ok: false, errors: [{ code: 'empty', message: 'กรุณาใส่ข้อความสรุป' }] };
  }

  const errors: BriefError[] = [];
  if (lineCount > maxLines) {
    errors.push({ code: 'too_many_lines', message: `สรุปต้องไม่เกิน ${maxLines} บรรทัด` });
  }

  const names = opts?.names?.map((name) => name.trim()).filter(Boolean) ?? [];
  for (const [index, line] of lines.entries()) {
    if (studentReference.test(line) || names.some((name) => line.includes(name))) {
      errors.push({
        code: 'student_ref',
        message: 'กรุณาลบชื่อ รหัส หรือเลขที่ของนักเรียนออกจากบรรทัดนี้',
        line: index + 1,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
