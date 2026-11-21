import type { ToolDefinition } from './types';

const timeZone = 'Asia/Bangkok';

export const serverClock: ToolDefinition = {
  name: 'server_clock',
  description: 'อ่านวันและเวลาปัจจุบันในเขตเวลา Asia/Bangkok จากเซิร์ฟเวอร์',
  input: { type: 'object', properties: {}, additionalProperties: false },
  gate: 'allow',
  execute: (_input, { count }) => ({
    time: new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone,
    }).format(new Date()),
    timeZone,
    count,
  }),
};
