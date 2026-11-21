import { z } from 'zod';
import { ownerOf, ToolError } from './identity';
import { saveMemory } from './memory-store';
import { nonBlank, validatedTool } from './validated';

export const memorySave = validatedTool(
  z.strictObject({ text: nonBlank, userConfirmed: z.boolean() }),
  {
    name: 'memory_save',
    description:
      'บันทึกข้อความสั้นที่ครูยืนยันให้จำ ต้องถามครูก่อนว่าให้จำไว้ไหม (ใช้ถ้อยคำตามบุคลิกของตัวเอง) และได้คำตอบรับ (หรือครูสั่งให้จำเอง) แล้วส่ง userConfirmed เป็น true ห้ามบันทึกคะแนน รายงาน หรือข้อมูลส่วนตัว',
    gate: 'allow',
    execute: ({ text, userConfirmed }, context) => {
      if (userConfirmed !== true)
        throw new ToolError('not_confirmed', 'ต้องถามครูและได้รับการยืนยันก่อนบันทึก');
      return saveMemory(ownerOf(context).key, text);
    },
  },
);
