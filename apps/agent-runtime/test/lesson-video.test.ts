import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lessonVideoDeps } from '../src/lib/lesson-video/deps';
import { resetDrafts } from '../src/lib/lesson-video/drafts';
import { resetLimits } from '../src/lib/lesson-video/limits';
import { checkStory } from '../src/lib/lesson-video/rules';
import { LESSON_VIDEO_LABEL, type Shot, type Story } from '../src/lib/lesson-video/story';
import { lessonVideoCreate } from '../src/tools/lesson_video_create';
import { lessonVideoDraft } from '../src/tools/lesson_video_draft';

const types = [
  'wide establishing',
  'close-up',
  'extreme macro',
  'from below',
  "bird's-eye",
  'cutaway cross-section',
];
const topic = 'การระเหย';
const grade = 'ป.4';
const teacher = 'teacher-1';
const fakeKey = 'sk-fake-lesson-video-key-not-for-network';
const midnight = Date.parse('2026-11-21T17:00:00Z');
let now: number;
const fetchGuard = vi.fn(() => {
  throw new Error('Network is forbidden in lesson-video tests');
});

function fixture(count = 11): Story {
  const examples = count >= 12 ? 2 : 1;
  const beats: Shot['beat'][] = [
    'hook',
    ...Array<Shot['beat']>(count - examples - 3).fill('explain'),
    ...Array<Shot['beat']>(examples).fill('example'),
    'recap',
    'quiz',
  ];
  return {
    title: 'น้ำหายไปไหน',
    character: { name: 'หยด', description: 'A blue paper droplet' },
    shots: Array.from({ length: count }, (_, index): Shot => ({
      n: index + 1,
      beat: beats[index]!,
      shot_type: types[index % types.length]!,
      visual_idea: `formation stage ${index}`,
      image_prompt: `Paper scene ${index}, no text`,
      character: { show: true, x: 20, y: 60, size: 20 },
      narration_th: 'ลองดูว่าผมเปลี่ยนไปยังไง',
      key_term_th: 'ไอน้ำ',
      caption_th: 'น้ำกลายเป็นไอ',
    })),
  };
}

function context(ownerId: string) {
  return { ownerId, signal: new AbortController().signal, count: 0 };
}

function draft(ownerId = teacher, input: unknown = { topic, grade }) {
  return lessonVideoDraft.execute(input, context(ownerId));
}

async function draftId(ownerId = teacher) {
  const result = (await draft(ownerId)) as { ok: boolean; draftId: string };
  expect(result.ok).toBe(true);
  return result.draftId;
}

function create(id: string, ownerId = teacher) {
  return lessonVideoCreate.execute({ draftId: id, confirmed: true }, context(ownerId));
}

beforeEach(() => {
  now = midnight - 60_000;
  resetLimits(() => now);
  resetDrafts();
  fetchGuard.mockClear();
  vi.stubGlobal('fetch', fetchGuard);
  vi.stubEnv('LESSON_VIDEO_MEDIA_ENABLED', 'true');
  vi.stubEnv('OPENAI_API_KEY', fakeKey);
  vi.spyOn(lessonVideoDeps, 'writeStory').mockImplementation(async (_topic, _grade, count) =>
    fixture(count),
  );
  vi.spyOn(lessonVideoDeps, 'makeImage').mockResolvedValue(new Uint8Array(7));
  vi.spyOn(lessonVideoDeps, 'makeVoice').mockResolvedValue(new Uint8Array(3));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetLimits();
  resetDrafts();
  expect(fetchGuard).not.toHaveBeenCalled();
});

describe('checkStory', () => {
  it.each([10, 11, 12])('accepts a valid %i-shot story', (count) => {
    expect(checkStory(fixture(count))).toEqual([]);
  });

  const cases: [string, (story: Story) => void, string][] = [
    [
      'too few shots',
      (s) => {
        s.shots.pop();
        s.shots.pop();
      },
      'ได้ 9',
    ],
    [
      'too many shots',
      (s) => {
        s.shots.push(s.shots[0]!, s.shots[1]!);
      },
      'ได้ 13',
    ],
    [
      'missing hook',
      (s) => {
        s.shots[0]!.beat = 'explain';
      },
      'hook',
    ],
    [
      'missing quiz',
      (s) => {
        s.shots.at(-1)!.beat = 'recap';
      },
      'quiz',
    ],
    [
      'missing example',
      (s) => {
        s.shots[8]!.beat = 'explain';
      },
      'example',
    ],
    [
      'missing recap',
      (s) => {
        s.shots[9]!.beat = 'explain';
      },
      'recap',
    ],
    [
      'long narration',
      (s) => {
        s.shots[0]!.narration_th = 'ก'.repeat(71);
      },
      'บทพูดเกิน 70',
    ],
    [
      'long caption',
      (s) => {
        s.shots[0]!.caption_th = 'ก'.repeat(41);
      },
      'คำบรรยายเกิน 40',
    ],
    [
      'blank visual idea',
      (s) => {
        s.shots[0]!.visual_idea = ' ';
      },
      'shots.0.visual_idea',
    ],
    [
      'duplicate visual idea',
      (s) => {
        s.shots[1]!.visual_idea = ` ${s.shots[0]!.visual_idea.toUpperCase()} `;
      },
      'visual_idea ซ้ำ',
    ],
    [
      'repeated framing',
      (s) => {
        s.shots[1]!.shot_type = s.shots[0]!.shot_type;
      },
      'shot_type ซ้ำ',
    ],
    [
      'too little variety',
      (s) => {
        s.shots.forEach((shot, i) => {
          shot.shot_type = types[i % 5]!;
        });
      },
      'อย่างน้อย 6',
    ],
    [
      'incorrect shot number',
      (s) => {
        s.shots[0]!.n = 2;
      },
      'n เท่ากับ 1',
    ],
    [
      'bad placement',
      (s) => {
        s.shots[0]!.character.x = 90;
      },
      'ตำแหน่งหรือขนาด',
    ],
  ];
  it.each(cases)('flags %s', (_name, edit, message) => {
    const story = fixture();
    edit(story);
    expect(checkStory(story).join('\n')).toContain(message);
  });

  it('reports a malformed story without including its values', () => {
    expect(checkStory({ title: fakeKey })).toEqual([
      'แก้ข้อมูลที่ character',
      'แก้ข้อมูลที่ shots',
    ]);
  });
});

describe('lesson_video_draft', () => {
  it('rewrites with feedback and presents only teacher-facing fields', async () => {
    vi.mocked(lessonVideoDeps.writeStory).mockResolvedValueOnce(fixture(10));
    const result = await draft();
    expect(lessonVideoDeps.writeStory).toHaveBeenNthCalledWith(2, topic, grade, 11, [
      'ครูขอ 11 ช็อต กรุณาปรับจำนวนช็อตให้ตรง',
    ]);
    expect(result).toMatchObject({
      ok: true,
      label: LESSON_VIDEO_LABEL,
      shotCount: 11,
      title: fixture().title,
    });
    expect(JSON.stringify(result)).not.toContain('image_prompt');
    expect(lessonVideoDeps.makeImage).not.toHaveBeenCalled();
    expect(lessonVideoDeps.makeVoice).not.toHaveBeenCalled();
  });

  it('returns problems after two rewrites and rejects more than 12 shots', async () => {
    vi.mocked(lessonVideoDeps.writeStory).mockResolvedValue(fixture(13));
    const result = await draft();
    expect(result).toMatchObject({
      ok: false,
      problems: expect.arrayContaining([expect.stringContaining('ได้ 13')]),
    });
    expect(result).not.toHaveProperty('draftId');
    expect(lessonVideoDeps.writeStory).toHaveBeenCalledTimes(3);
    await expect(draft(teacher, { topic, grade, shots: 13 })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    expect(lessonVideoDeps.writeStory).toHaveBeenCalledTimes(3);
  });

  it('caps saved drafts per teacher and resets on the next Bangkok day', async () => {
    vi.mocked(lessonVideoDeps.writeStory)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    expect(await draft()).toMatchObject({ ok: false });
    for (let i = 0; i < 15; i++) await draftId();
    await expect(draft()).rejects.toMatchObject({ code: 'draft_limit_reached' });
    await draftId('other');
    now = midnight;
    await draftId();
  });
});

describe('lesson_video_create', () => {
  it('refuses missing, foreign, expired and unconfirmed drafts', async () => {
    await expect(create('missing')).rejects.toMatchObject({ code: 'draft_not_found' });
    const id = await draftId();
    await expect(create(id, 'other')).rejects.toMatchObject({ code: 'draft_not_found' });
    for (const input of [{ draftId: id }, { draftId: id, confirmed: false }]) {
      await expect(lessonVideoCreate.execute(input, context(teacher))).rejects.toMatchObject({
        code: 'invalid_input',
      });
    }
    now += 2 * 60 * 60 * 1000;
    await expect(create(id)).rejects.toMatchObject({ code: 'draft_not_found' });
    expect(lessonVideoDeps.makeImage).not.toHaveBeenCalled();
  });

  it('keeps the draft when media is disabled', async () => {
    const id = await draftId();
    vi.stubEnv('LESSON_VIDEO_MEDIA_ENABLED', 'TRUE');
    await expect(create(id)).rejects.toMatchObject({ code: 'media_disabled' });
    expect(lessonVideoDeps.makeImage).not.toHaveBeenCalled();
    vi.stubEnv('LESSON_VIDEO_MEDIA_ENABLED', 'true');
    expect(await create(id)).toMatchObject({ ok: true });
  });

  it('generates a sprite and ordered byte counts, with at most four requests in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    async function media(bytes: number) {
      peak = Math.max(peak, ++inFlight);
      await new Promise<void>((resolve) => setImmediate(resolve));
      inFlight--;
      return new Uint8Array(bytes);
    }
    vi.mocked(lessonVideoDeps.makeImage).mockImplementation(() => media(7));
    vi.mocked(lessonVideoDeps.makeVoice).mockImplementation(() => media(3));
    const id = await draftId();
    expect(await create(id)).toMatchObject({
      ok: true,
      clipId: expect.any(String),
      label: LESSON_VIDEO_LABEL,
      shotCount: 11,
      assets: fixture().shots.map(({ n }) => ({ n, imageBytes: 7, audioBytes: 3 })),
    });
    expect(peak).toBe(4);
    expect(lessonVideoDeps.makeImage).toHaveBeenCalledTimes(12);
    expect(lessonVideoDeps.makeImage).toHaveBeenCalledWith(
      expect.stringContaining('A blue paper droplet'),
      {
        size: '1024x1024',
        transparent: true,
      },
    );
    expect(lessonVideoDeps.makeVoice).toHaveBeenCalledTimes(11);
  });

  it('enforces 5 clips per teacher and releases the daily cap at Bangkok midnight', async () => {
    const id = await draftId();
    for (let i = 0; i < 5; i++) await create(id);
    await expect(create(id)).rejects.toMatchObject({
      code: 'clip_limit_reached',
      message: expect.stringContaining('5'),
    });
    now = midnight;
    expect(await create(id)).toMatchObject({ ok: true });
  });

  it('enforces 20 clips system-wide, including concurrent reservations', async () => {
    for (let i = 0; i < 4; i++) {
      const owner = `owner-${i}`;
      const id = await draftId(owner);
      await Promise.all(Array.from({ length: 5 }, () => create(id, owner)));
    }
    const id = await draftId(teacher);
    await expect(create(id)).rejects.toMatchObject({
      code: 'clip_limit_reached',
      message: expect.stringContaining('20'),
    });
  });

  it('releases a failed media slot and never exposes a credential in results or errors', async () => {
    vi.mocked(lessonVideoDeps.writeStory).mockRejectedValueOnce(new Error(fakeKey));
    await expect(draft()).rejects.toMatchObject({
      code: 'draft_failed',
      message: expect.not.stringContaining(fakeKey),
    });
    const result = await draft();
    expect(JSON.stringify(result)).not.toContain(fakeKey);
    const { draftId: id } = result as { draftId: string };
    for (let i = 0; i < 4; i++) await create(id);
    vi.mocked(lessonVideoDeps.makeVoice).mockRejectedValueOnce(new Error(fakeKey));
    await expect(create(id)).rejects.toMatchObject({
      code: 'media_failed',
      message: expect.not.stringContaining(fakeKey),
    });
    expect(JSON.stringify(await create(id))).not.toContain(fakeKey);
    await expect(create(id)).rejects.toMatchObject({ code: 'clip_limit_reached' });
  });
});
