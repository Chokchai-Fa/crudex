import { z } from 'zod';

/**
 * Class-level sample (ตัวอย่าง) rooms the principal should look at, identical to agent-runtime's
 * get_school_summary for the same sample rows (checked by agent-runtime/test/demo-story.test.ts).
 */
export const sampleFlaggedClasses = [
  {
    label: 'ม.2/1',
    mean: 3.5,
    maxScore: 6,
    meanLabel: '3.5/6 คะแนน',
    meanPercent: 58,
    weakTopics: [{ topic: 'การนำพีทาโกรัสไปใช้ในชีวิตจริง', correctPercent: 37.5 }],
    line: 'ม.2/1 เฉลี่ย 3.5/6 (58%) แต่หัวข้อการนำพีทาโกรัสไปใช้ในชีวิตจริงถูกแค่ 37.5% ต่ำกว่าเกณฑ์ 50%',
  },
] as const;

export const publishedBriefSchema = z.object({
  title: z.string(),
  lines: z.array(z.string()),
  publishedAt: z.string(),
});
export type PublishedMorningBrief = z.infer<typeof publishedBriefSchema>;

/** "สรุปเช้าวันเสาร์\n1. …\n2. …" → title + numbered lines exactly as published. */
export function splitBrief(text: string, publishedAt: string): PublishedMorningBrief {
  const [title = '', ...lines] = text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  return { title, lines, publishedAt };
}
