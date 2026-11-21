import { z } from 'zod';
import { lessonVideoDeps } from '../lib/lesson-video/deps';
import { storeDraft } from '../lib/lesson-video/drafts';
import { MAX_SHOTS, MIN_SHOTS, reserveDraft } from '../lib/lesson-video/limits';
import { checkStory } from '../lib/lesson-video/rules';
import { LESSON_VIDEO_LABEL, storySchema } from '../lib/lesson-video/story';
import { ownerOf, ToolError } from './identity';
import { nonBlank, validatedTool } from './validated';

export const lessonVideoDraft = validatedTool(
  z.strictObject({
    topic: nonBlank,
    grade: nonBlank,
    shots: z.int().min(MIN_SHOTS).max(MAX_SHOTS).optional(),
  }),
  {
    name: 'lesson_video_draft',
    description: 'ร่างบทคลิปสั้นให้ครูตรวจและแก้ก่อนสร้างภาพและเสียง',
    gate: 'allow',
    async execute({ topic, grade, shots = 11 }, context) {
      const { id } = ownerOf(context);
      const releaseDraft = reserveDraft(id);
      let saved = false;
      try {
        let problems: string[] | undefined;
        for (let attempt = 0; attempt < 3; attempt++) {
          const raw = await lessonVideoDeps.writeStory(topic, grade, shots, problems);
          problems = checkStory(raw);
          if (problems.length) continue;
          const story = storySchema.parse(raw);
          if (story.shots.length !== shots) {
            problems = [`ครูขอ ${shots} ช็อต กรุณาปรับจำนวนช็อตให้ตรง`];
            continue;
          }
          const draftId = storeDraft(id, story);
          saved = true;
          return {
            ok: true,
            draftId,
            label: LESSON_VIDEO_LABEL,
            title: story.title,
            character: story.character,
            shots: story.shots.map(
              ({ n, beat, narration_th, key_term_th, caption_th, visual_idea }) => ({
                n,
                beat,
                narration_th,
                key_term_th,
                caption_th,
                visual_idea,
              }),
            ),
            shotCount: story.shots.length,
            note: 'ยังไม่เสียค่าภาพหรือเสียง ครูดูและแก้บทก่อน',
          };
        }
        return { ok: false, problems };
      } catch {
        throw new ToolError('draft_failed', 'ร่างบทไม่สำเร็จ ลองใหม่ได้');
      } finally {
        if (!saved) releaseDraft();
      }
    },
  },
);
