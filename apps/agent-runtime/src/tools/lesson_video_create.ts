import { z } from 'zod';
import { lessonVideoDeps } from '../lib/lesson-video/deps';
import { findDraft } from '../lib/lesson-video/drafts';
import { reserve } from '../lib/lesson-video/limits';
import { STYLE } from '../lib/lesson-video/rules';
import { LESSON_VIDEO_LABEL, type Story } from '../lib/lesson-video/story';
import { ownerOf, ToolError } from './identity';
import { nonBlank, validatedTool } from './validated';

async function generateAssets(story: Story) {
  const assets = story.shots.map(({ n }) => ({ n, imageBytes: 0, audioBytes: 0 }));
  const spritePrompt = `Single small paper-cut character, centred, front view, isolated on a transparent background. ${story.character.description}. ${STYLE}`;
  const jobs: (() => Promise<void>)[] = [
    async () => {
      const sprite = await lessonVideoDeps.makeImage(spritePrompt, {
        size: '1024x1024',
        transparent: true,
      });
      if (!sprite.byteLength) throw new Error('Empty character sprite');
    },
  ];
  for (const [index, shot] of story.shots.entries()) {
    const asset = assets[index]!;
    jobs.push(
      async () => {
        const image = await lessonVideoDeps.makeImage(`${shot.image_prompt}. ${STYLE}`, {
          size: '1536x1024',
        });
        if (!image.byteLength) throw new Error('Empty shot image');
        asset.imageBytes = image.byteLength;
      },
      async () => {
        const audio = await lessonVideoDeps.makeVoice(shot.narration_th);
        if (!audio.byteLength) throw new Error('Empty shot audio');
        asset.audioBytes = audio.byteLength;
      },
    );
  }
  let failed = false;
  let next = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (!failed) {
        const job = jobs[next++];
        if (!job) return;
        try {
          await job();
        } catch {
          failed = true;
        }
      }
    }),
  );
  if (failed) throw new Error('Asset generation failed');
  return assets;
}

export const lessonVideoCreate = validatedTool(
  z.strictObject({ draftId: nonBlank, confirmed: z.literal(true) }),
  {
    name: 'lesson_video_create',
    description: 'สร้างภาพและเสียงจากบทที่ครูอนุมัติแล้ว ระยะที่ 1 คืนเฉพาะจำนวนไบต์',
    gate: 'ask',
    async execute({ draftId }, context) {
      const { id } = ownerOf(context);
      const story = findDraft(draftId, id);
      if (!story) throw new ToolError('draft_not_found', 'ไม่พบบทฉบับร่าง กรุณาร่างบทใหม่');
      if (process.env.LESSON_VIDEO_MEDIA_ENABLED !== 'true') {
        throw new ToolError('media_disabled', 'ยังไม่เปิดให้สร้างวิดีโอ บทฉบับร่างยังเก็บอยู่');
      }
      const release = reserve(id);
      try {
        const assets = await generateAssets(story);
        return {
          ok: true,
          clipId: crypto.randomUUID(),
          label: LESSON_VIDEO_LABEL,
          shotCount: assets.length,
          assets,
          note: 'ระยะที่ 1: ยังไม่ได้เก็บหรือเปิดสื่อ ครูดูได้เฉพาะบทและจำนวนไฟล์ที่สร้างสำเร็จ',
        };
      } catch {
        release();
        throw new ToolError('media_failed', 'สร้างภาพหรือเสียงไม่สำเร็จ บทยังอยู่');
      }
    },
  },
);
