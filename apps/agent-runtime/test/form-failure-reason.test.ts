import { afterEach, expect, it, vi } from 'vitest';
import type { SchoolScope } from '../src/school';
import { additionWorksheet } from '../src/tools/fraction_addition_form';
import { BRIDGE_TIMEOUT_MS, saveVerifiedAssessment } from '../src/tools/save_assessment';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

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

const school = Response.json({
  id: 'quiz',
  formUrl: '/play/quiz',
  worksheetUrl: '/worksheets/quiz',
});
const run = (bridge: () => Promise<Response> | Response) => {
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', 'https://bridge.private.test/exec');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL | string) =>
      String(url).startsWith('https://bridge.private.test') ? bridge() : school.clone(),
    ),
  );
  return saveVerifiedAssessment(additionWorksheet(5), new AbortController().signal, scope());
};

it('keeps the school link and says why the Google Form failed, without leaking the bridge address', async () => {
  const cases: [string, () => Promise<Response> | Response][] = [
    ['http_500', () => new Response('boom', { status: 500 })],
    ['invalid_response', () => Response.json({ ok: false })],
    ['timeout', () => Promise.reject(new DOMException('slow', 'TimeoutError'))],
    [
      'network',
      () => Promise.reject(new Error('connect to https://bridge.private.test/exec failed')),
    ],
  ];
  for (const [reason, bridge] of cases) {
    const result = await run(bridge);
    expect(result).toMatchObject({
      playUrl: '/play/quiz',
      googleForm: 'failed',
      googleFormReason: reason,
    });
    expect(JSON.stringify(result)).not.toContain('bridge.private.test');
  }
});

it('says the bridge is not configured when there is no address', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => school.clone()),
  );
  vi.stubEnv('SCHOOL_BOT_APPS_SCRIPT_URL', '');
  const result = await saveVerifiedAssessment(
    additionWorksheet(5),
    new AbortController().signal,
    scope(),
  );
  expect(result).toMatchObject({ googleForm: 'failed' });
});

it('waits longer than the old 60 s limit for the bridge', () => {
  expect(BRIDGE_TIMEOUT_MS).toBeGreaterThan(60_000);
});
