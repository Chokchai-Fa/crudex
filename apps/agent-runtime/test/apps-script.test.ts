import { afterEach, expect, it, vi } from 'vitest';
import { saveAssessment } from '../src/tools/save_assessment';
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
});

it('sends a checked quiz and returns the respondent link from Apps Script', async () => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://bridge.invalid');
  const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(form));
  vi.stubGlobal('fetch', request);
  await expect(saveAssessment.execute(input, context)).resolves.toEqual({
    formUrl: form.url,
    formId: form.formId,
    mode: 'apps-script',
  });
  const payload = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
  expect(payload.action).toBe('createQuiz');
  expect(payload.questions).toHaveLength(3);
  expect(payload.questions[0]).toEqual({
    text: input.questions[0]!.text,
    choices: ['2/6', '3/4', '1/6', '2/4'],
    answerIndex: 1,
    points: 1,
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
