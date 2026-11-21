import type { ToolDefinition } from './types';

const timeZone = 'Asia/Bangkok';

/** Today in Bangkok as a Thai Buddhist-era date, e.g. "21 พฤศจิกายน 2569", plus the ISO date. */
export function thaiDate(now = new Date()) {
  const thai = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone,
  })
    .format(now)
    .replace(/^(\d+ \S+) (?:พ\.ศ\. )?(\d{4})$/u, '$1 $2');
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
  return { thai, iso };
}

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
