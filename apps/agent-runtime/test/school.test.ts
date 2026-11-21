import { createHmac } from 'node:crypto';
import { expect, it, vi, afterEach } from 'vitest';
import { signedTurn } from '../../../packages/shared/src/school-dispatch.schema';
import { validSchoolTurn, type SchoolScope } from '../src/school';
import { additionWorksheet } from '../src/tools/fraction_addition_form';
import { saveVerifiedAssessment } from '../src/tools/save_assessment';
afterEach(() => vi.unstubAllGlobals());
const scope = (): SchoolScope => ({
  freshSession: false,
  agentId: 'jum',
  role: 'teacher',
  schoolId: crypto.randomUUID(),
  ownerId: crypto.randomUUID(),
  classId: crypto.randomUUID(),
  runId: crypto.randomUUID(),
  attemptId: crypto.randomUUID(),
  expiresAt: Date.now() + 120000,
  credential: crypto.randomUUID() + crypto.randomUUID(),
  callbackOrigin: 'https://school.test',
});
it('binds school, owner, class, agent, prompt and attempt to the active sandbox', () => {
  const claims = scope();
  const owner = claims.schoolId + '/' + claims.ownerId;
  const signature = createHmac('sha256', 'boot-secret')
    .update(signedTurn(claims, 'worksheet'))
    .digest('hex');
  expect(validSchoolTurn(claims, 'worksheet', signature, owner, 'boot-secret')).toBe(true);
  expect(
    validSchoolTurn(
      { ...claims, kahootConnected: true },
      'worksheet',
      signature,
      owner,
      'boot-secret',
    ),
  ).toBe(false);
  expect(validSchoolTurn(claims, 'other', signature, owner, 'boot-secret')).toBe(false);
  expect(
    validSchoolTurn({ ...claims, classId: null }, 'worksheet', signature, owner, 'boot-secret'),
  ).toBe(false);
  expect(validSchoolTurn(claims, 'worksheet', signature, owner, 'replacement-secret')).toBe(false);
  expect(
    validSchoolTurn(
      { ...claims, expiresAt: Date.now() - 1 },
      'worksheet',
      signature,
      owner,
      'boot-secret',
    ),
  ).toBe(false);
});
it('retries a verified school worksheet with the same invocation ID and published choice order', async () => {
  const s = scope();
  const fetcher = vi.fn(async () =>
    Response.json({ id: 'quiz', formUrl: '/play/quiz', worksheetUrl: '/worksheets/quiz' }),
  );
  vi.stubGlobal('fetch', fetcher);
  const data = additionWorksheet(5);
  const result = await saveVerifiedAssessment(data, new AbortController().signal, s);
  expect(result.mode).toBe('school');
  await saveVerifiedAssessment(data, new AbortController().signal, s);
  expect(fetcher).toHaveBeenCalledTimes(2);
  const calls = fetcher.mock.calls as unknown as [URL, RequestInit][];
  expect(String(calls[0]![0])).toBe(
    s.callbackOrigin + '/api/internal/runs/' + s.runId + '/tools/save_assessment',
  );
  expect(calls[0]![1].body).toBe(calls[1]![1].body);
  const saved = JSON.parse(String(calls[0]![1].body)).assessment as typeof data;
  expect(new Set(saved.questions.map((q) => q.correctChoiceId)).size).toBe(4);
  expect(saved.questions.map((q) => q.choices.map((c) => c.text))).toEqual(
    result.questions.map((q) => q.choices),
  );
});
it('also creates the Google Form in school mode and keeps the school record when the bridge fails', async () => {
  const s = scope();
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://bridge.test/exec');
  const google = 'https://docs.google.com/forms/d/e/googleForm123/viewform';
  let bridgeUp = true;
  const fetcher = vi.fn(async (url: URL | string) =>
    String(url).startsWith('https://bridge.test')
      ? bridgeUp
        ? Response.json({ ok: true, formId: 'googleForm123', url: google })
        : new Response('down', { status: 500 })
      : Response.json({ id: 'quiz', formUrl: '/play/quiz', worksheetUrl: '/worksheets/quiz' }),
  );
  vi.stubGlobal('fetch', fetcher);
  const data = additionWorksheet(5);
  expect(await saveVerifiedAssessment(data, new AbortController().signal, s)).toMatchObject({
    mode: 'school',
    formUrl: google,
    playUrl: '/play/quiz',
    googleForm: 'created',
    googleFormId: 'googleForm123',
  });
  const bodies = (fetcher.mock.calls as unknown as [URL, RequestInit][]).map(([, init]) =>
    JSON.parse(String(init.body)),
  );
  const bridged = bodies.find((body) => body.action === 'createQuiz');
  const recorded = bodies.find((body) => body.assessment);
  expect(bridged.questions.map((q: { answerIndex: number }) => 'c' + q.answerIndex)).toEqual(
    recorded.assessment.questions.map((q: { correctChoiceId: string }) => q.correctChoiceId),
  );
  bridgeUp = false;
  const failed = await saveVerifiedAssessment(data, new AbortController().signal, s);
  expect(failed).toMatchObject({
    formUrl: '/play/quiz',
    playUrl: '/play/quiz',
    googleForm: 'failed',
  });
  expect(failed).not.toHaveProperty('googleFormId');
  vi.unstubAllEnvs();
});
