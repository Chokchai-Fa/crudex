import { results } from '../data/sample';
import { checkBrief } from '../lib/brief-guard';
import { ownerOf, ToolError } from './identity';
import type { ToolDefinition } from './types';

export interface PublishedBrief {
  id: string;
  ownerId: string;
  text: string;
  createdAt: number;
}

/** In-process until the gateway stores briefs for the principal's page and the 07:00 alarm. */
export const briefs: PublishedBrief[] = [];

const studentNames = results.map((_, i) => 'นักเรียนตัวอย่าง ' + String(i + 1).padStart(2, '0'));

export const publishBrief: ToolDefinition = {
  name: 'publish_brief',
  description:
    'ส่งสรุปเช้าฉบับสุดท้ายให้ ผอ. ระบบตรวจด้วยโค้ดว่าไม่เกิน 7 บรรทัดและไม่มีชื่อหรือรหัสนักเรียน ถ้าไม่ผ่านจะคืนข้อผิดพลาดให้แก้แล้วเรียกใหม่ ต้องผ่านการตรวจก่อนจึงจะถึง ผอ.',
  input: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input, context) => {
    const { text } = input as { text: string };
    const check = checkBrief(text, { names: studentNames });
    if (!check.ok) {
      throw new ToolError(
        'brief_rejected',
        check.errors
          .map((e) => `${e.code}${e.line ? ` (บรรทัด ${e.line})` : ''}: ${e.message}`)
          .join('; '),
      );
    }
    const brief: PublishedBrief = {
      id: 'brief-' + crypto.randomUUID().slice(0, 8),
      ownerId: ownerOf(context).id,
      text: text.trim(),
      createdAt: Date.now(),
    };
    briefs.push(brief);
    return {
      mode: 'mock',
      briefId: brief.id,
      text: brief.text,
      lines: brief.text.split(/\n/).filter((l) => l.trim()).length,
    };
  },
};
