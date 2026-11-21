import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportState, importState, loadState } from '../src/state';
import { getScores } from '../src/tools/get_scores';
import { formQuestions, saveAssessment } from '../src/tools/save_assessment';
import type { ToolContext } from '../src/tools/types';
import sample from './fixtures/assessment-sample.json';

const input = { ...sample, questions: sample.questions.slice(0, 3), expectedCount: 3 };
const context = { count: 1, signal: new AbortController().signal };
const form = {
  ok: true,
  formId: 'sample',
  url: 'https://docs.google.com/forms/d/e/sample/viewform',
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('sends a checked quiz and returns the respondent link from Apps Script', async () => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://bridge.invalid');
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(form));
  vi.stubGlobal('fetch', request);
  const published = await saveAssessment.execute(input, context);
  expect(published).toMatchObject({
    maxScore: 3,
    formUrl: form.url,
    formId: form.formId,
    mode: 'apps-script',
  });
  const payload = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
  expect(payload.action).toBe('createQuiz');
  expect(payload.questions).toHaveLength(3);
  const first = payload.questions[0];
  expect(first.text).toBe(input.questions[0]!.text);
  expect(first.choices[first.answerIndex]).toBe('3/4');
  expect(first.points).toBe(1);
  expect(published).toMatchObject({
    questions: payload.questions.map(
      (question: ReturnType<typeof formQuestions>[number], index: number) => ({
        id: input.questions[index]?.id,
        text: question.text,
        choices: question.choices,
        answer: 'กขคง'[question.answerIndex],
        points: 1,
      }),
    ),
  });
});

it('does not invent a form on an invalid response or missing configuration', async () => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', '');
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ...form, url: 'https://example.invalid/' }));
  vi.stubGlobal('fetch', request);
  await expect(saveAssessment.execute(input, context)).rejects.toMatchObject({
    code: 'unavailable',
  });
  expect(request).not.toHaveBeenCalled();
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://bridge.invalid');
  await expect(saveAssessment.execute(input, context)).rejects.toMatchObject({
    code: 'unavailable',
  });
});

it.each([1, 2, 3, 4, 5, 10, 29, 30])(
  'balances the correct positions across %i four-choice items',
  (count) => {
    const questions = Array.from({ length: count }, () => input.questions[0]!);
    const before = structuredClone(questions);
    const results = formQuestions(questions);
    expect(formQuestions(structuredClone(questions))).toEqual(results);
    const counts = [0, 0, 0, 0];
    for (const item of results) {
      counts[item.answerIndex]!++;
      expect(item.choices[item.answerIndex]).toBe('3/4');
      expect([...item.choices].sort()).toEqual(['1/6', '2/4', '2/6', '3/4']);
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    expect(questions).toEqual(before);
  },
);

it('tracks answer positions separately for each number of choices', () => {
  const full = input.questions[0]!;
  const short = { ...full, choices: full.choices.slice(0, 2) };
  const results = formQuestions([full, short, full, short, full, full]);
  expect(new Set([results[1]!.answerIndex, results[3]!.answerIndex]).size).toBe(2);
  expect(
    new Set(results.filter((item) => item.choices.length === 4).map((item) => item.answerIndex))
      .size,
  ).toBe(4);
});

describe('scores from published forms', () => {
  const emptyState = { version: 1, memory: {}, approvals: [], notifications: [], briefs: [] };
  const teacher = {
    ...context,
    ownerId: 'teacher-00000000-0000-4000-8000-000000000001',
    classId: 'class-m2-1',
  };
  const otherTeacher = { ...teacher, ownerId: 'teacher-00000000-0000-4000-8000-000000000002' };
  const quiz = {
    ...input,
    title: 'แบบทดสอบสามข้อ',
    questions: input.questions.map((q, index) => ({
      ...q,
      topic: index === 2 ? 'หัวข้อ ข' : 'หัวข้อ ก',
    })),
  };
  const submittedAt = '2026-11-23T08:00:00.000Z';
  const row = { studentId: 'demo-23', submittedAt, result: '111' };
  const responseBody = (formId: string, responses: unknown[] = [row]) => ({
    ok: true,
    formId,
    title: quiz.title,
    questions: quiz.questions.map(({ text }) => text),
    responses,
  });
  const request = vi.fn<typeof fetch>();

  async function publish(formId: string, session: ToolContext = teacher, assessment = quiz) {
    request.mockResolvedValueOnce(
      Response.json({ ...form, formId, url: form.url.replace('/sample/', `/${formId}/`) }),
    );
    await saveAssessment.execute(assessment, session);
  }

  beforeEach(() => {
    vi.stubEnv('DATA_DIR', undefined);
    vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'bridge-fixture');
    vi.stubGlobal('fetch', request.mockReset());
    importState(emptyState);
  });

  it('uses valid rows, typed ids and per-question topics for the latest assessment', async () => {
    await publish('mapping');
    request.mockResolvedValueOnce(
      Response.json(
        responseBody('mapping', [
          { studentId: 's-04', submittedAt, result: '1xx' },
          { ...row, submittedAt: '2026-11-22T08:00:00.000Z', result: '11x' },
          { ...row, studentId: ['test-1', 'sample.invalid'].join('@') },
          { ...row, studentId: 'ชื่อทดสอบ' },
          { ...row, studentId: 'SampleName' },
          { ...row, studentId: 'id-123456789012345678901234567890' },
          { ...row, result: '11?' },
          { ...row, result: '11' },
          { ...row, submittedAt: 'invalid' },
          null,
        ]),
      ),
    );

    const result = await getScores.execute({}, teacher);
    expect(result).toMatchObject({
      hasData: true,
      mode: 'form',
      source: 'ตัวอย่าง: คำตอบทดสอบจาก Google Form',
      classId: teacher.classId,
      assessmentId: 'form:mapping',
      title: 'ตัวอย่าง: คำตอบทดสอบจาก Google Form – แบบทดสอบสามข้อ',
      topic: 'เศษส่วน',
      maxScore: 3,
      threshold: 1.5,
      n: 2,
      mean: 1.5,
      scoreLabel: '3/6 คะแนน (2 คน คนละ 3 คะแนน) เฉลี่ย 1.5/3',
      students: [
        {
          studentId: 's-04',
          displayName: 'นักเรียนตัวอย่าง 04',
          score: 1,
          wrongTopics: [
            { topic: 'หัวข้อ ก', wrong: 1, total: 2 },
            { topic: 'หัวข้อ ข', wrong: 1, total: 1 },
          ],
        },
        {
          studentId: 'demo-23',
          displayName: 'demo-23',
          score: 2,
          wrongTopics: [{ topic: 'หัวข้อ ข', wrong: 1, total: 1 }],
        },
      ],
      belowThreshold: [{ studentId: 's-04', displayName: 'นักเรียนตัวอย่าง 04', score: 1 }],
      wrongByTopic: [
        { topic: 'หัวข้อ ข', wrong: 2, total: 2, wrongRate: 1 },
        { topic: 'หัวข้อ ก', wrong: 1, total: 4, wrongRate: 0.25 },
      ],
      repeatedlyBelowThreshold: expect.arrayContaining([
        { studentId: 's-04', times: 3, displayName: 'นักเรียนตัวอย่าง 04' },
      ]),
      history: [
        { assessmentId: 'demo-m2-1-real-numbers' },
        { assessmentId: 'demo-m2-1-prism-cylinder' },
        { assessmentId: 'demo-m2-1-pythagoras' },
        { assessmentId: 'form:mapping', date: '2026-11-23', belowThresholdCount: 1 },
      ],
    });
    expect(request.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ action: 'getResponses', formId: 'mapping' }),
    });
  });

  it('uses the recorded form title when the bridge returns an empty title', async () => {
    await publish('untitled');
    request.mockResolvedValueOnce(Response.json({ ...responseBody('untitled'), title: '' }));
    expect(await getScores.execute({}, teacher)).toMatchObject({
      mode: 'form',
      title: 'ตัวอย่าง: คำตอบทดสอบจาก Google Form – แบบทดสอบสามข้อ',
    });
  });

  it('records the form for the room the teacher named when the session has no room', async () => {
    const demo = { ...teacher, classId: 'class-p5-2' };
    request.mockResolvedValueOnce(
      Response.json({ ...form, formId: 'named', url: form.url.replace('/sample/', '/named/') }),
    );
    await saveAssessment.execute({ ...quiz, grade: 'ม.2', classLabel: 'ม.2/1' }, demo);
    request.mockResolvedValueOnce(Response.json(responseBody('named')));
    expect(await getScores.execute({ classLabel: 'ม.2/1' }, demo)).toMatchObject({
      mode: 'form',
      classId: 'class-m2-1',
    });
    request.mockResolvedValueOnce(
      Response.json({
        ...form,
        formId: 'untaught',
        url: form.url.replace('/sample/', '/untaught/'),
      }),
    );
    await saveAssessment.execute({ ...quiz, grade: 'ม.2', classLabel: 'ม.2/3' }, demo);
    expect(await getScores.execute({ classLabel: 'ม.2/2' }, demo)).toMatchObject({
      mode: 'sample',
    });
  });

  it('isolates answers by teacher and room and rejects untaught rooms before fetching', async () => {
    await publish('private-form');
    await publish('private-form', otherTeacher);
    request.mockClear();
    await expect(getScores.execute({}, otherTeacher)).resolves.toMatchObject({
      mode: 'sample',
      n: 8,
    });
    await expect(getScores.execute({ classLabel: 'ม.2/2' }, teacher)).resolves.toMatchObject({
      mode: 'sample',
      hasData: false,
    });
    await expect(getScores.execute({ classLabel: 'ม.2/3' }, teacher)).rejects.toMatchObject({
      code: 'class_not_taught',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    'no form',
    'missing configuration',
    'HTTP error',
    'network error',
    'invalid reply',
    'wrong form',
    'private endpoint in reply',
    'no responses',
  ])('keeps the sample scores for %s', async (reason) => {
    const formId = `fallback-${reason.replaceAll(' ', '-')}`;
    if (reason !== 'no form') await publish(formId);
    switch (reason) {
      case 'missing configuration':
        vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', undefined);
        break;
      case 'HTTP error':
        request.mockResolvedValueOnce(new Response('private error', { status: 503 }));
        break;
      case 'network error':
        request.mockRejectedValueOnce(new Error('private error'));
        break;
      case 'invalid reply':
        request.mockResolvedValueOnce(Response.json({ ...responseBody(formId), questions: [123] }));
        break;
      case 'wrong form':
        request.mockResolvedValueOnce(Response.json(responseBody('another-form')));
        break;
      case 'private endpoint in reply':
        request.mockResolvedValueOnce(
          Response.json({
            ...responseBody(formId),
            title: process.env.SCHOOL_BOT_APPS_SCRIPT_URL,
          }),
        );
        break;
      case 'no responses':
        request.mockResolvedValueOnce(Response.json(responseBody(formId, [])));
        break;
    }
    const result = await getScores.execute({}, teacher);
    expect(result).toMatchObject({
      mode: 'sample',
      assessmentId: 'demo-m2-1-pythagoras',
      n: 8,
      mean: 3.5,
      scoreLabel: '28/48 คะแนน (8 คน คนละ 6 คะแนน) เฉลี่ย 3.5/6',
      note: expect.stringMatching(/Google Form.*ข้อมูลตัวอย่าง/u),
    });
    expect(JSON.stringify(result)).not.toContain('private error');
    expect(JSON.stringify(result)).not.toContain(
      process.env.SCHOOL_BOT_APPS_SCRIPT_URL || 'unused-endpoint',
    );
    if (reason === 'no form' || reason === 'missing configuration') {
      expect(request).toHaveBeenCalledTimes(reason === 'no form' ? 0 : 1);
    }
  });

  it('uses the tool abort signal to cancel the bridge read and returns sample scores', async () => {
    await publish('abort-read');
    const controller = new AbortController();
    request.mockImplementationOnce(async (_, init) => {
      const signal = init?.signal;
      if (!signal) return Response.json(responseBody('abort-read'));
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(new Error('private error')), { once: true });
      });
    });
    const scores = getScores.execute({}, { ...teacher, signal: controller.signal });
    controller.abort();
    await expect(scores).resolves.toMatchObject({ mode: 'sample', n: 8 });
  });

  it.each(['form', 'empty', 'failed'])('reuses a %s bridge reply for 60 seconds', async (kind) => {
    const formId = `cached-${kind}`;
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = Date.now();
    await publish(formId);
    request.mockResolvedValueOnce(
      kind === 'failed'
        ? new Response(null, { status: 503 })
        : Response.json(responseBody(formId, kind === 'empty' ? [] : [row])),
    );
    const [first, concurrent] = await Promise.all([
      getScores.execute({}, teacher),
      getScores.execute({}, teacher),
    ]);
    expect(concurrent).toEqual(first);
    expect(first).toMatchObject({ mode: kind === 'form' ? 'form' : 'sample' });
    vi.setSystemTime(now + 59_999);
    expect(await getScores.execute({}, teacher)).toEqual(first);
    expect(request).toHaveBeenCalledTimes(2);

    vi.setSystemTime(now + 60_000);
    request.mockResolvedValueOnce(Response.json(responseBody(formId, [{ ...row, result: 'xxx' }])));
    await expect(getScores.execute({}, teacher)).resolves.toMatchObject({ mode: 'form', mean: 0 });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('uses the unique taught grade without a session room and skips ambiguous grades', async () => {
    const { classId: _, ...noRoom } = teacher;
    await publish('unique-grade', noRoom, { ...quiz, grade: 'ป.5' });
    await publish('ambiguous-grade', noRoom, { ...quiz, grade: 'ม.2' });
    request.mockResolvedValueOnce(Response.json(responseBody('unique-grade')));
    await expect(getScores.execute({ classLabel: 'ป.5/2' }, noRoom)).resolves.toMatchObject({
      mode: 'form',
      assessmentId: 'form:unique-grade',
      classId: 'class-p5-2',
    });
    await expect(getScores.execute({ classLabel: 'ม.2/1' }, noRoom)).resolves.toMatchObject({
      mode: 'sample',
    });
    await expect(getScores.execute({ classLabel: 'ม.2/2' }, noRoom)).resolves.toMatchObject({
      mode: 'sample',
    });
    expect(request).toHaveBeenCalledTimes(3);
  });

  it('keeps the newest six form records per room and restores them from disk and a snapshot', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'crudex-form-state-'));
    try {
      vi.stubEnv('DATA_DIR', dir);
      for (let i = 1; i <= 7; i++) await publish(`registry-${i}`);
      await publish('other-room', { ...teacher, classId: 'class-m2-2' });
      await publish('registry-4');

      const snapshot = exportState();
      expect(snapshot).toMatchObject({
        forms: {
          [teacher.ownerId]: expect.arrayContaining([
            {
              formId: 'registry-7',
              classId: teacher.classId,
              ownerId: teacher.ownerId,
              title: quiz.title,
              topic: quiz.topic,
              questionTopics: ['หัวข้อ ก', 'หัวข้อ ก', 'หัวข้อ ข'],
              maxScore: 3,
              createdAt: expect.any(Number),
            },
            expect.objectContaining({ formId: 'other-room', classId: 'class-m2-2' }),
          ]),
        },
      });
      expect(JSON.stringify(snapshot)).not.toContain('registry-1');
      expect(JSON.stringify(snapshot).match(/registry-4/g)).toHaveLength(1);

      const reclassified = snapshot.forms[teacher.ownerId]?.map((record) => ({
        ...record,
        ownerId: otherTeacher.ownerId,
      }));
      expect(() =>
        importState({
          ...snapshot,
          forms: { ...snapshot.forms, [otherTeacher.ownerId]: reclassified },
        }),
      ).toThrow();

      vi.stubEnv('DATA_DIR', undefined);
      importState(emptyState);
      await expect(getScores.execute({}, teacher)).resolves.toMatchObject({ mode: 'sample' });
      vi.stubEnv('DATA_DIR', dir);
      loadState();
      expect(exportState()).toEqual(snapshot);

      importState(emptyState);
      importState(JSON.parse(JSON.stringify(snapshot)));
      request.mockResolvedValueOnce(Response.json(responseBody('registry-7')));
      await expect(getScores.execute({}, teacher)).resolves.toMatchObject({
        mode: 'form',
        assessmentId: 'form:registry-7',
      });
      request.mockResolvedValueOnce(Response.json(responseBody('other-room')));
      await expect(getScores.execute({ classLabel: 'ม.2/2' }, teacher)).resolves.toMatchObject({
        hasData: true,
        mode: 'form',
        history: [{ assessmentId: 'form:other-room' }],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
