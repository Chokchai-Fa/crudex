import { afterEach, expect, it, vi } from 'vitest';
import { runCheck } from '../src/tools/check_assessment';
import { additionWorksheet, fractionAdditionForm } from '../src/tools/fraction_addition_form';

it('generates thirty distinct grade-5 addition questions with four distinct numerical choices', () => {
  const assessment = additionWorksheet(30);
  const { result } = runCheck(assessment);
  expect(result.errors).toEqual([]);
  expect(result.verified).toHaveLength(30);
  expect(new Set(assessment.questions.map(({ text }) => text)).size).toBe(30);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('publishes once and renders the exact published choices and keys', async () => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://example.invalid/bridge');
  const url = 'https://docs.google.com/forms/d/e/sample/viewform';
  const fetch = vi.fn(async (_endpoint: string, init: RequestInit) => {
    expect(JSON.parse(String(init.body)).questions).toHaveLength(10);
    return Response.json({ ok: true, formId: 'sample', url });
  });
  vi.stubGlobal('fetch', fetch);
  const result = (await fractionAdditionForm.execute(
    { count: 10 },
    { count: 1, signal: new AbortController().signal },
  )) as { worksheet: string; formUrl: string; bridgeElapsedMs: number };
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(result.formUrl).toBe(url);
  expect(result.bridgeElapsedMs).toBeGreaterThanOrEqual(0);
  const sent = JSON.parse(String(fetch.mock.calls[0]![1].body)).questions as {
    text: string;
    choices: string[];
    answerIndex: number;
  }[];
  for (const [index, question] of sent.entries()) {
    expect(result.worksheet).toContain(
      `${index + 1}. ${question.text}\n${question.choices.map((text, i) => `${'กขคง'[i]}. ${text}`).join('   ')}`,
    );
  }
  expect(result.worksheet).toContain(
    'เฉลย: ' + sent.map((q, i) => `${i + 1}. ${'กขคง'[q.answerIndex]}`).join('   '),
  );
});
