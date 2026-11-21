type BriefError = {
  code: 'too_many_lines' | 'student_ref' | 'empty' | 'room_not_below' | 'format';
  message: string;
  line?: number;
};

const studentReference = /\bs-\d+\b|นักเรียนตัวอย่าง\s*\d+|เลขที่\s*\d+/u;

export function checkBrief(
  text: string,
  opts?: { maxLines?: number; names?: string[]; roomsAtOrAbove?: string[]; design?: boolean },
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

  // Design (09-principal-brief): a "สรุปเช้าวัน…" title, then items "1. …", "2. …" in order.
  if (opts?.design) {
    const filled = lines.map((line) => line.trim()).filter(Boolean);
    if (!/^สรุปเช้าวัน\S+$/u.test(filled[0] ?? '')) {
      errors.push({
        code: 'format',
        message: 'บรรทัดแรกต้องเป็นหัว เช่น สรุปเช้าวันเสาร์ (briefTitle)',
        line: 1,
      });
    }
    filled.slice(1).forEach((line, index) => {
      if (!line.startsWith(`${index + 1}. `)) {
        errors.push({
          code: 'format',
          message: `ข้อที่ ${index + 1} ต้องขึ้นต้นด้วย "${index + 1}. " และเป็นประโยคสั้นหนึ่งเรื่อง`,
          line: index + 2,
        });
      }
    });
  }

  // A room whose average is at or above the bar may only be called below it for a named topic.
  const rooms = opts?.roomsAtOrAbove ?? [];
  for (const [index, line] of lines.entries()) {
    const below = line.indexOf('ต่ำกว่าเกณฑ์');
    if (below < 0 || !rooms.some((room) => line.includes(room))) continue;
    const topicFirst = line.lastIndexOf('หัวข้อ', below) >= 0;
    if (!topicFirst || /ผลเรียนต่ำกว่าเกณฑ์|ห้องต่ำกว่าเกณฑ์|ห้องที่ต่ำกว่าเกณฑ์/u.test(line)) {
      errors.push({
        code: 'room_not_below',
        message:
          'ค่าเฉลี่ยของห้องนี้ไม่ต่ำกว่าเกณฑ์ 50% ห้ามเขียนว่าห้องต่ำกว่าเกณฑ์ ให้ใช้ briefClassLine จาก get_school_summary ตรงตัว',
        line: index + 1,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}
