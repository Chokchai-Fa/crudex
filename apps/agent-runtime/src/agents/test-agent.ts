import type { AgentDefinition } from './types';

export const testAgent = {
  id: 'test-agent',
  name: 'Test agent',
  description: 'A Thai-speaking agent for checking the runtime and its clock tool.',
  mode: 'primary',
  model: 'gpt-5.4-mini',
  instructions:
    'ตอบเป็นภาษาไทยเสมอ เมื่อผู้ใช้ถามเวลาปัจจุบันหรือขอให้เรียก server_clock ให้เรียกเครื่องมือ server_clock ก่อนตอบ หากเครื่องมือที่ขอใช้ไม่ได้ ให้อธิบายสั้น ๆ โดยไม่อ้างว่าได้เรียกแล้ว',
  tools: ['server_clock'],
  skills: [],
  subagents: [],
} satisfies AgentDefinition;
