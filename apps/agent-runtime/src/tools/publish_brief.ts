import { classHistories, studentIdentity } from '../data/class-history';
import { checkBrief } from '../lib/brief-guard';
import { schoolClasses } from '../data/school';
import { briefs, persistState, type PublishedBrief } from '../state';
import { ownerOf, ToolError } from './identity';
import type { ToolDefinition } from './types';

export { briefs };
export type { PublishedBrief } from '../state';

const studentNames = Object.values(classHistories).flatMap(
  (history) => history?.results.map((_, index) => studentIdentity(index).displayName) ?? [],
);

export const publishBrief: ToolDefinition = {
  name: 'publish_brief',
  description:
    'ส่งสรุปเช้าฉบับสุดท้ายให้ ผอ. รูปแบบตาม design: บรรทัดแรก briefTitle (เช่น สรุปเช้าวันเสาร์) แล้วข้อ 1. 2. 3. ... ประโยคสั้นข้อละเรื่อง ระบบตรวจด้วยโค้ดว่าไม่เกิน 7 บรรทัด ไม่มีชื่อหรือรหัสนักเรียน และไม่เรียกห้องที่ค่าเฉลี่ยไม่ต่ำกว่า 50% ว่าต่ำกว่าเกณฑ์ ถ้าไม่ผ่านจะคืนข้อผิดพลาดให้แก้แล้วเรียกใหม่ ต้องผ่านการตรวจก่อนจึงจะถึง ผอ.',
  input: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input, context) => {
    const { text } = input as { text: string };
    const roomsAtOrAbove = schoolClasses
      .filter((c) => c.mean >= c.maxScore * 0.5)
      .map((c) => c.label);
    const check = checkBrief(text, { names: studentNames, roomsAtOrAbove, design: true });
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
    persistState();
    return {
      mode: 'mock',
      briefId: brief.id,
      text: brief.text,
      lines: brief.text.split(/\n/).filter((l) => l.trim()).length,
    };
  },
};
