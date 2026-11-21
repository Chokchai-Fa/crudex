import { z } from 'zod';

const brand = /kahoot|คาฮู[ทตด]/i;
const action =
  /สร้าง|ทำ|จัด|ออกแบบ|เตรียม|ขอ\s*(?:เกม|แบบทดสอบ|kahoot)|\b(create|make|build|generate|prepare)\b/i;
const instruction =
  /^(?:(?:น้องแจ๋ว|แจ๋ว|รบกวน|ช่วย|ขอให้|อยากให้|ลอง|please|(?:ฝาก|ให้|บอก|สั่ง)(?:ให้)?\s*(?:พี่)?เจ๋ง(?:ช่วย)?)[\s,:ๆ]*)*(?:สร้าง|ทำ|จัด|ออกแบบ|เตรียม|ขอ|(?:create|make|build|generate|prepare)\b)\s*(?:(?:เกม|แบบทดสอบ|ควิซ)\s*)?(?:(?:ใน|บน|ด้วย|เป็น|ผ่าน|an?\b)\s*)?(?:kahoot|คาฮู[ทตด])/i;

export function requestsKahoot(text: string) {
  const newest = text.split('ข้อความใหม่จากครู:').at(-1) ?? text;
  return (
    !/วิธี|ยังไง|เสร็จหรือยัง|เสร็จหรือไม่|\bhow to\b/i.test(newest) &&
    brand.test(newest) &&
    action.test(newest)
  );
}

export function directlyRequestsKahoot(text: string) {
  const newest = (text.split('ข้อความใหม่จากครู:').at(-1) ?? text).trim();
  if (!requestsKahoot(newest) || !instruction.test(newest)) return false;
  if (
    /ไม่(?:ต้อง|ให้|อยาก|ขอ)?\s*(?:สร้าง|ทำ|จัด|เตรียม)|(?:don't|do not)\s+(?:create|make)/i.test(
      newest,
    )
  )
    return false;
  return !/(?:แล้ว(?:ก็)?|พร้อม(?:กับ)?|และ|\n|\band\b)\s*(?:ช่วย\s*)?(?:สร้าง|ทำ|ส่ง|สรุป|จัด|ออกแบบ|เตรียม|create|make|send|summarize)\s*(?:ใบงาน|สไลด์|ข้อสอบ|แบบทดสอบ|เอกสาร|ใบเบิก|คะแนน|รายงาน|google form|worksheet|slides)/i.test(
    newest,
  );
}

const receiptSchema = z.object({
  error: z.literal(false).optional(),
  kahoot: z.object({ uuid: z.uuid(), title: z.string().trim().min(1).max(120) }),
});

const urlFields = z.object({
  error: z.literal(false).optional(),
  url: z.string().optional(),
  editorUrl: z.string().optional(),
  editor_url: z.string().optional(),
});

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function kahootReceipt(output: unknown) {
  return receiptSchema.safeParse(typeof output === 'string' ? parseJson(output) : output).data
    ?.kahoot;
}

export function kahootEditorUrl(output: unknown) {
  const json = typeof output === 'string' ? parseJson(output) : output;
  const fields = urlFields.safeParse(json).data;
  if (json && typeof json === 'object' && !fields) return;
  const candidate =
    fields?.editorUrl ??
    fields?.editor_url ??
    fields?.url ??
    (typeof json === 'string'
      ? json
      : typeof output === 'string'
        ? output.match(/https:\/\/[^\s<>"')\]]+/)?.[0]
        : undefined);
  const url = candidate && URL.parse(candidate);
  if (
    url &&
    url.protocol === 'https:' &&
    url.host === 'create.kahoot.it' &&
    !url.username &&
    !url.password &&
    url.pathname.startsWith('/creator/')
  )
    return url.href;
}

export function kahootRequiresConnection(error: unknown) {
  return /\b(?:kahoot_not_connected|needs_auth|invalid_token)\b/i.test(JSON.stringify(error) ?? '');
}

export const kahootEditorTool = 'crudex_kahoot_get_kahoot_editor_url';

export type KahootResult =
  | { status: 'created'; kahootId: string; title: string; editorUrl?: string }
  | { status: 'connect_required' | 'failed' };

export const kahootFailure = {
  connect_required:
    'พี่เจ๋งยังสร้าง Kahoot ไม่ได้ค่ะ กดปุ่ม Kahoot ในแอปโรงเรียนเพื่อเชื่อมบัญชีก่อนนะคะ',
  failed: 'พี่เจ๋งยังสร้าง Kahoot ไม่สำเร็จค่ะ',
};
