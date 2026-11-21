import { afterEach, expect, it, vi } from 'vitest';
import { resetCheckFailuresForTests } from '../src/tools/check-failures';
import { checkAssessmentTool, runCheck } from '../src/tools/check_assessment';
import { additionWorksheet, fractionAdditionForm } from '../src/tools/fraction_addition_form';

const context = { count: 1, signal: new AbortController().signal };
const assessment = additionWorksheet(1);

async function check(ok: boolean, sessionID?: string) {
  expect(
    await checkAssessmentTool.execute(
      { ...assessment, expectedCount: ok ? 1 : 2 },
      { ...context, sessionID },
    ),
  ).toMatchObject({ ok });
}

async function expectRefused(sessionID?: string) {
  await expect(
    fractionAdditionForm.execute({ count: 10 }, { ...context, sessionID }),
  ).rejects.toMatchObject({
    code: 'fallback_not_allowed',
    message: expect.stringContaining('ให้เขียนโจทย์เองและเรียก check_assessment ตรวจก่อน'),
  });
}

it('generates thirty distinct grade-5 addition questions with four distinct numerical choices', () => {
  const assessment = additionWorksheet(30);
  const { result } = runCheck(assessment);
  expect(result.errors).toEqual([]);
  expect(result.verified).toHaveLength(30);
  expect(new Set(assessment.questions.map(({ text }) => text)).size).toBe(30);
});

afterEach(() => {
  resetCheckFailuresForTests();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('refuses the fallback with zero or one failed checks', async () => {
  await expectRefused();
  await check(false);
  await expectRefused();
});

it('resets the failure streak after a successful check', async () => {
  await check(false);
  await check(true);
  await check(false);
  await expectRefused();
});

it('keeps failure streaks separate by session', async () => {
  await check(false, 'first');
  await check(false, 'second');
  await expectRefused('first');
  await expectRefused('second');
  await check(false, 'first');
  await expectRefused('second');
  await expectRefused();
});

it('publishes after two failed checks, renders the published choices and keys, and resets the streak', async () => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://example.invalid/bridge');
  const url = 'https://docs.google.com/forms/d/e/sample/viewform';
  const fetch = vi.fn(async (_endpoint: string, init: RequestInit) => {
    expect(JSON.parse(String(init.body)).questions).toHaveLength(10);
    return Response.json({ ok: true, formId: 'sample', url });
  });
  vi.stubGlobal('fetch', fetch);
  await check(false);
  await check(false);
  const result = (await fractionAdditionForm.execute({ count: 10 }, context)) as {
    worksheet: string;
    formUrl: string;
    bridgeElapsedMs: number;
  };
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
  await expectRefused();
});
