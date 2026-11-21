import { MAX_SHOTS, MIN_SHOTS } from './limits';
import { storySchema } from './story';

export const STYLE =
  'Handmade vintage pop-up book paper collage, with torn white fibre edges, visible paper grain, fold creases, and soft shadows between layers. Muted teal, ochre, brick red, sage and cream, with hand-inked details and even studio light. No text, letters, numbers, logos or watermarks.';

export const STORY_RULES = `
Write a lively, accurate Thai lesson for the requested grade. Return JSON only with this shape:
{ "title": string, "character": { "name": string, "description": string }, "shots": [{ "n": integer, "beat": "hook"|"explain"|"example"|"recap"|"quiz", "shot_type": string, "visual_idea": string, "image_prompt": string, "character": { "show": boolean, "x": number, "y": number, "size": number }, "narration_th": string, "key_term_th": string, "caption_th": string }] }

Use the requested number of shots (10–12), numbered from 1.
- hook: one opening question or surprising observation from daily life. Skip the greeting.
- explain: 5–7 shots in cause-and-effect order. Cover one idea in each shot and carry it forward from the previous shot. Introduce each new term just after the viewer sees what it describes, with an everyday comparison.
- example: 1–2 shots showing the same concept in the daily life of children in Thailand.
- recap: one shot putting the important terms in order.
- quiz: end with one quick question for the class.

Choose a small paper character that fits the topic and describe its appearance in story.character. Let the character speak in the first person, using lively, short Thai sentences, playful sounds and words suited to the grade. Use at most 70 characters per narration and 40 per caption. Give each shot one key term.

Use at least six distinct shot types: wide establishing, close-up, extreme macro, from below, bird's-eye, cutaway cross-section, side-by-side comparison, or everyday object close-up. Never repeat the previous shot type or reuse a visual idea. Give each visual_idea a short English label.
Write the English image_prompt for the background alone in wide 3:2 format, with Thai settings where appropriate and room for the paper character. Keep text and characters out of the background. ${STYLE}
Set character.show to false where the character would obscure details. Place its centre at x=15–85%, y=25–70%, with width size=8–30%. Vary the size with the framing.
`.trim();

export const VOICE_STYLE =
  'พูดภาษาไทยเสียงสดใสเหมือนพิธีกรรายการวิทยาศาสตร์สำหรับเด็ก จังหวะเร็ว กระชับ ออกเสียงคำสำคัญให้ชัด ใช้อารมณ์ขันและเสียงประกอบอย่าง ฟู่ว ซู่ ๆ ตุ๋ม ให้สนุก';

export function checkStory(story: unknown): string[] {
  const parsed = storySchema.safeParse(story);
  if (!parsed.success) {
    return parsed.error.issues.map(({ path }) => `แก้ข้อมูลที่ ${path.join('.') || 'story'}`);
  }
  const { shots } = parsed.data;
  const problems: string[] = [];
  if (shots.length < MIN_SHOTS || shots.length > MAX_SHOTS) {
    problems.push(`ต้องมี ${MIN_SHOTS}–${MAX_SHOTS} ช็อต (ได้ ${shots.length})`);
  }
  const beats = shots.map(({ beat }) => beat).join(' ');
  if (!/^hook(?: explain){5,7}(?: example){1,2} recap quiz$/.test(beats)) {
    problems.push('เรียงจังหวะเป็น hook, explain 5–7 ช็อต, example 1–2 ช็อต, recap และ quiz');
  }
  const ideas = new Set<string>();
  const types = new Set<string>();
  let previousType = '';
  for (const [index, shot] of shots.entries()) {
    const n = index + 1;
    const type = shot.shot_type.toLowerCase();
    const idea = shot.visual_idea.toLowerCase();
    if (shot.n !== n) problems.push(`ช็อตที่ ${n} ต้องมี n เท่ากับ ${n}`);
    if ([...shot.narration_th].length > 70) problems.push(`ช็อตที่ ${n} บทพูดเกิน 70 ตัวอักษร`);
    if ([...shot.caption_th].length > 40) problems.push(`ช็อตที่ ${n} คำบรรยายเกิน 40 ตัวอักษร`);
    if (ideas.has(idea)) problems.push(`ช็อตที่ ${n} มี visual_idea ซ้ำ`);
    if (previousType === type) problems.push(`ช็อตที่ ${n} มี shot_type ซ้ำกับช็อตก่อนหน้า`);
    const { show, x, y, size } = shot.character;
    if (show && (x < 15 || x > 85 || y < 25 || y > 70 || size < 8 || size > 30)) {
      problems.push(`ช็อตที่ ${n} ใช้ตำแหน่งหรือขนาดตัวละครนอกช่วงที่กำหนด`);
    }
    types.add(type);
    ideas.add(idea);
    previousType = type;
  }
  if (types.size < 6) problems.push('ใช้ shot_type อย่างน้อย 6 แบบ');
  return problems;
}
