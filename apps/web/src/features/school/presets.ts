import type { AgentId } from '@repo/shared';

/**
 * Preset requests per assistant that the team has checked work end to end.
 * Turn one off with `enabled: false`; the chat shows up to 3 enabled presets per assistant.
 * "ม.2/1" in a text is replaced with the current room label.
 */
export interface Preset {
  agent: AgentId;
  text: string;
  /** Short line under the card: what the teacher gets back. */
  result: string;
  enabled: boolean;
  background?: boolean;
}

export const presets: Preset[] = [
  {
    agent: 'jaew',
    text: 'กำลังจะสอน ม.2/1 เตรียมสอนให้หน่อย',
    result: 'ได้แผนเตรียมสอน',
    enabled: true,
    background: true,
  },
  {
    agent: 'jum',
    text: 'ทำใบงานพีทาโกรัส ม.2 5 ข้อ เป็น PDF',
    result: 'ได้ PDF ใบงาน',
    enabled: true,
    background: true,
  },
  {
    agent: 'jum',
    text: 'ทำแบบทดสอบพีทาโกรัส ม.2 5 ข้อ เป็น Google Form',
    result: 'ได้ลิงก์ Google Form',
    enabled: true,
    background: true,
  },
  {
    agent: 'jeng',
    text: 'ทำสไลด์สอนพีทาโกรัส ม.2/1 6 หน้า',
    result: 'ได้สไลด์สอน',
    enabled: true,
    background: true,
  },
  {
    agent: 'jeng',
    text: 'ทำเกม Kahoot พีทาโกรัส 5 ข้อ',
    result: 'ได้เกม Kahoot',
    enabled: true,
    background: true,
  },
  {
    agent: 'porn',
    text: 'ทำเอกสารเบิกค่าอุปกรณ์สร้างรูปสามเหลี่ยมมุมฉาก 750 บาท',
    result: 'ได้ใบเบิกรออนุมัติ',
    enabled: true,
    background: true,
  },
  {
    agent: 'nun',
    text: 'สรุปคะแนน ม.2/1 ใครต้องติวเรื่องไหน',
    result: 'ได้สรุปรายห้อง',
    enabled: true,
  },
  {
    agent: 'rungchao',
    text: 'สรุปเช้าวันนี้',
    result: 'ได้สรุปเช้า 7 บรรทัด',
    enabled: true,
    background: true,
  },
  {
    agent: 'lekha_por',
    text: 'มีเอกสารรออนุมัติอะไรบ้าง',
    result: 'ได้รายการรออนุมัติ',
    enabled: true,
  },
];

export function presetsFor(agent: AgentId, room: string) {
  return presets
    .filter((p) => p.enabled && p.agent === agent)
    .slice(0, 3)
    .map((p) => ({ ...p, text: p.text.replaceAll('ม.2/1', room) }));
}

/** Instant, client-side acknowledgement in each assistant's voice (no model call). */
const taskAcks: Record<AgentId, string[]> = {
  jaew: ['รับทราบค่า กำลังจัดการให้นะคะ', 'ได้เลยค่ะคุณครู เดี๋ยวหนูดูให้นะคะ'],
  jum: ['รับทราบค่ะ หนูกำลังเตรียมให้นะคะ', 'ได้ค่ะ ขอหนูเช็กให้ละเอียดแป๊บนึงนะคะ'],
  jeng: ['จัดไปครับ! พี่กำลังทำให้', 'รับทราบครับ เดี๋ยวพี่ลงมือเลย'],
  porn: ['ได้จ้ะ ป้ากำลังดูให้นะจ๊ะ', 'รับทราบจ้ะ ป้าขอเช็กงบแป๊บนึงนะ'],
  nun: ['รับทราบค่ะ หนูกำลังดูข้อมูลให้นะคะ', 'ได้ค่ะ ขอหนูดูคะแนนแป๊บนึงนะคะ'],
  rungchao: ['รับทราบค่ะ ท่าน ผอ. รุ่งเช้ากำลังสรุปให้ค่ะ'],
  lekha_por: ['รับทราบครับ ท่าน ผอ. ลุงกำลังดูเอกสารให้ครับ'],
};
const thinkingAcks: Record<AgentId, string> = {
  jaew: 'ขอคิดแป๊บนะคะ…',
  jum: 'ขอหนูคิดแป๊บนะคะ…',
  jeng: 'ขอพี่คิดแป๊บนะครับ…',
  porn: 'ขอป้าคิดแป๊บนะจ๊ะ…',
  nun: 'ขอหนูคิดแป๊บนะคะ…',
  rungchao: 'ขอคิดแป๊บนะคะ…',
  lekha_por: 'ขอลุงคิดแป๊บนะครับ…',
};
const taskWords =
  /ช่วย|ทำ|สร้าง|เตรียม|สรุป|ส่ง|จัด|ออก|เขียน|ตรวจ|เบิก|วิเคราะห์|หา|ค้น|ให้หน่อย|ขอ(?!บคุณ)/u;
const chatOnly = /^(สวัสดี|หวัดดี|ดีจ้า|ดีค่ะ|ดีครับ|hello|hi\b|ขอบคุณ|ขอบใจ|โอเค|ok\b)/iu;

export function ackFor(agent: AgentId, prompt: string) {
  const text = prompt.trim();
  const isTask = !chatOnly.test(text) && taskWords.test(text);
  if (!isTask) return thinkingAcks[agent];
  const options = taskAcks[agent];
  return options[Math.floor(Math.random() * options.length)]!;
}

/** Default to conversation. Only explicit creation requests need background delivery. */
export function isBackgroundRequest(prompt: string) {
  const request = prompt
    .trim()
    .replace(/^(?:hello|hey|hi|สวัสดี(?:ครับ|ค่ะ)?)[,!:，\s]+/iu, '')
    .replace(/^(?:(?:can|could|would|will) you\s+)?(?:please\s+)?/iu, '')
    .replace(/^(?:กรุณา|รบกวน|ช่วย)(?:คุณ)?\s*/u, '');
  const create =
    /^(?:สร้าง|เตรียม|จัดทำ|ทำ|ออกแบบ|ผลิต|เขียน|ร่าง|(?:generate|create|prepare|design|draft|make|build|write)\b)/iu;
  const artifact =
    /(?:ใบงาน|แบบฝึก|ข้อสอบ|แบบทดสอบ|สไลด์|เอกสาร|รายงาน|แผนการสอน|แบบฟอร์ม|เกม|worksheet|quiz|slides?|presentation|report|lesson plan|document|pdf|kahoot)/iu;
  return create.test(request) && artifact.test(request);
}
