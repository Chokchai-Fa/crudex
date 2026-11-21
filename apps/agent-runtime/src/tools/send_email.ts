import { testMailbox } from './inbox';
import type { ToolDefinition } from './types';

export const sendEmail: ToolDefinition = {
  name: 'send_email',
  description: 'ส่งอีเมลให้ผู้เกี่ยวข้อง (ในเดโมส่งได้เฉพาะกล่องทดสอบ และครูต้องกดยืนยันทุกครั้ง)',
  input: {
    type: 'object',
    properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } },
    required: ['to', 'subject', 'body'],
    additionalProperties: false,
  },
  gate: 'ask',
  execute: (input) => {
    const { subject, body } = input as { to: string; subject: string; body: string };
    const id = 'mail-' + crypto.randomUUID().slice(0, 8);
    testMailbox.push({ id, to: 'test-mailbox', subject, body, createdAt: Date.now() });
    return { mode: 'mock', mailId: id, deliveredTo: 'test-mailbox' };
  },
};
