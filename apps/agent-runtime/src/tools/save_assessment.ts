import { assertVerifiedAssessment } from '../lib/verified';
import { assessmentSchema, runCheck } from './check_assessment';
import { ToolError } from './identity';
import type { ToolDefinition } from './types';

/** Mock publisher: replaced by the Apps Script bridge that creates the real Google Form. */
export const publisher = {
  publish: async (_assessment: unknown) => {
    const formId = 'form-' + crypto.randomUUID().slice(0, 8);
    return { mode: 'mock' as 'mock' | 'apps-script', formId, url: `https://example.invalid/forms/${formId}` };
  },
};

export const saveAssessment: ToolDefinition = {
  name: 'save_assessment',
  description:
    'ตรวจเฉลยด้วยโค้ดอีกรอบ แล้วสร้างแบบทดสอบ Google Form คืน formUrl และ mode ใช้หลัง check_assessment ผ่านเท่านั้น ห้ามแต่งลิงก์เอง ถ้าชุดไม่ผ่านจะไม่สร้างอะไร',
  input: assessmentSchema,
  gate: 'allow',
  execute: async (input) => {
    const { assessment } = runCheck(input);
    const expectedCount = (input as { expectedCount?: number }).expectedCount;
    assertVerifiedAssessment(assessment, expectedCount);
    try {
      const { mode, formId, url } = await publisher.publish(assessment);
      return { formUrl: url, mode, formId };
    } catch (error) {
      throw new ToolError('unavailable', 'สร้างแบบทดสอบไม่สำเร็จ: ' + (error instanceof Error ? error.message : 'unknown'));
    }
  },
};
