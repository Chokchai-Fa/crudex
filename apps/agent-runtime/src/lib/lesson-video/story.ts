import { z } from 'zod';

export const LESSON_VIDEO_LABEL = 'ร่างโดย AI ครูตรวจก่อนใช้';

const text = z.string().trim().min(1);
export const shotSchema = z.object({
  n: z.int().positive(),
  beat: z.enum(['hook', 'explain', 'example', 'recap', 'quiz']),
  shot_type: text,
  visual_idea: text,
  image_prompt: text,
  character: z.object({ show: z.boolean(), x: z.number(), y: z.number(), size: z.number() }),
  narration_th: text,
  key_term_th: text,
  caption_th: text,
});

export const storySchema = z.object({
  title: text,
  character: z.object({ name: text, description: text }),
  shots: z.array(shotSchema),
});

export type Story = z.infer<typeof storySchema>;
export type Shot = z.infer<typeof shotSchema>;
