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
