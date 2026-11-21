import type { AssessmentContent } from '@repo/shared';

const contextLabel = '\n\nข้อมูลอ้างอิงจากใบงานในห้อง (School API): ';

export function teacherMessage(prompt: string) {
  const index = prompt.lastIndexOf(contextLabel);
  if (index < 0) return prompt;
  try {
    const data = JSON.parse(prompt.slice(index + contextLabel.length));
    if (data?.version === 1 && Array.isArray(data.questions)) return prompt.slice(0, index);
  } catch {
    // Older runs contain plain teacher messages.
  }
  return prompt;
}

export function referencesWorksheet(prompt: string) {
  if (
    /(?:สร้าง|ทำ|เตรียม|ออกแบบ)ใบงาน/u.test(prompt) &&
    !/ใบงานเดิม|ชุดเดิม|โจทย์เดิม|จากใบงาน/u.test(prompt)
  )
    return false;
  return /เฉลย|โจทย์เดิม|ใบงาน(?:ที่|เดิม|นี้)|ชุด(?:เดิม|เมื่อกี้|นี้)|(?:ข้อ(?:ที่)?\s*[\d๐-๙]+|คำตอบของข้อ)/u.test(
    prompt,
  );
}

export function withWorksheet(prompt: string, sheet: AssessmentContent) {
  const normalized = prompt.replace(/[๐-๙]/gu, (digit) => String(digit.charCodeAt(0) - 0x0e50));
  const requested = [...normalized.matchAll(/ข้อ(?:ที่)?\s*(\d+)/gu)].map((m) => Number(m[1]));
  const questions = sheet.questions.flatMap((q, i) => {
    if (requested.length && !requested.includes(i + 1)) return [];
    return [
      {
        number: i + 1,
        text: q.text,
        choices: q.choices.map((c) => c.text),
        answer: q.choices.find((c) => c.id === q.correctChoiceId)?.text,
      },
    ];
  });
  if (!questions.length || requested.some((n) => n < 1 || n > sheet.questions.length))
    throw new Error('ไม่มีข้อที่ระบุในใบงานนี้ กรุณาตรวจหมายเลขข้อ');
  const result =
    prompt + contextLabel + JSON.stringify({ version: 1, title: sheet.title, questions });
  if (result.length > 4000)
    throw new Error('คำขอกับโจทย์ที่อ้างถึงยาวเกินขนาดที่ส่งได้ กรุณาระบุข้อเดียวหรือย่อคำขอ');
  return result;
}
