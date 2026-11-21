import { z } from 'zod';
import { testMailbox } from './inbox';
import { nonBlank, validatedTool } from './validated';

export const sendEmail = validatedTool(
  z.strictObject({ to: nonBlank, subject: nonBlank, body: nonBlank }),
  {
    name: 'send_email',
    description:
      'ส่งอีเมลให้ผู้เกี่ยวข้อง (ในเดโมส่งได้เฉพาะกล่องทดสอบ และครูต้องกดยืนยันทุกครั้ง)',
    gate: 'ask',
    execute: ({ subject, body }) => {
      const id = 'mail-' + crypto.randomUUID().slice(0, 8);
      testMailbox.push({ id, to: 'test-mailbox', subject, body, createdAt: Date.now() });
      return { mode: 'mock', mailId: id, deliveredTo: 'test-mailbox' };
    },
  },
);
