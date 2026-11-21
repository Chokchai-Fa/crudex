import { identityOf, ToolError } from './identity';
import { saveMemory } from './memory-store';
import type { ToolDefinition } from './types';

export const memorySave: ToolDefinition = {
  name: 'memory_save',
  description:
    'บันทึกข้อความสั้นที่ครูยืนยันให้จำ ต้องถามครูก่อนว่า "ให้ผมจำไว้ไหม" และได้คำตอบรับ (หรือครูสั่งให้จำเอง) แล้วส่ง userConfirmed เป็น true ห้ามบันทึกคะแนน รายงาน หรือข้อมูลส่วนตัว',
  input: {
    type: 'object',
    properties: { text: { type: 'string' }, userConfirmed: { type: 'boolean' } },
    required: ['text', 'userConfirmed'],
    additionalProperties: false,
  },
  gate: 'allow',
  execute: (input, context) => {
    const { text, userConfirmed } = input as { text: string; userConfirmed: boolean };
    if (userConfirmed !== true)
      throw new ToolError('not_confirmed', 'ต้องถามครูและได้รับการยืนยันก่อนบันทึก');
    return saveMemory(identityOf(context).ownerId, text);
  },
};
