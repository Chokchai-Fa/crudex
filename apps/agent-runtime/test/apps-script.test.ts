import { afterEach, expect, it, vi } from 'vitest';
import { formQuestions, saveAssessment } from '../src/tools/save_assessment';
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
  const first = payload.questions[0];
  expect(first.text).toBe(input.questions[0]!.text);
  expect(first.choices[first.answerIndex]).toBe('3/4');
  expect(first.points).toBe(1);
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
