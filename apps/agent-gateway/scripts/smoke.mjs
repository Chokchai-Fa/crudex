import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

const { AGENT_URL, AGENT_PASSCODE } = process.env;
assert(AGENT_URL && AGENT_PASSCODE, 'Smoke test needs AGENT_URL and AGENT_PASSCODE');

// Never include response bodies, cookies, or credentials in CI output.
const login = await fetch(new URL('/login', AGENT_URL), {
  method: 'POST',
  body: new URLSearchParams({ passcode: AGENT_PASSCODE }),
  redirect: 'manual',
  signal: AbortSignal.timeout(15_000),
});
assert.equal(login.status, 303, 'Sign-in failed');
const cookie = login.headers.get('set-cookie')?.split(';')[0];
assert(cookie, 'Sign-in did not return a session cookie');

const status = await fetch(new URL('/api/status', AGENT_URL), {
  headers: { cookie },
  signal: AbortSignal.timeout(15_000),
});
assert.equal(status.status, 200, 'Status route failed');
const info = await status.json();
assert(['stopped', 'starting', 'running'].includes(info.sandbox), 'Unexpected sandbox status');
assert(Number.isInteger(info.runsToday) && Number.isInteger(info.limit), 'Quota status missing');
console.log(`Sandbox ${info.sandbox}, runs ${info.runsToday}/${info.limit}`);

// The Worker and its Durable Object may switch versions at different times.
const expectedIds = ['jaew', 'jum', 'jeng', 'porn', 'nun'];
const deadline = performance.now() + 300_000;
for (;;) {
  const catalog = await fetch(new URL('/api/agents', AGENT_URL), {
    headers: { cookie },
    signal: AbortSignal.timeout(120_000),
  });
  assert.equal(catalog.status, 200);
  const ids = (await catalog.json()).map(({ id }) => id);
  const current = await fetch(new URL('/api/status', AGENT_URL), {
    headers: { cookie },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(current.status, 200);
  const { runtimeRevision } = await current.json();
  const revisionMatches = !process.env.GITHUB_SHA || runtimeRevision === process.env.GITHUB_SHA;
  if (revisionMatches && JSON.stringify(ids) === JSON.stringify(expectedIds)) break;
  if (performance.now() >= deadline) {
    assert.deepEqual(ids, expectedIds);
    assert(revisionMatches, 'Sandbox did not switch to the deployed revision');
  }
  console.log('Waiting for the teacher catalog after deploy');
  await delay(15_000);
}

async function chat(label, text) {
  const start = performance.now();
  const response = await fetch(new URL('/api/chat', AGENT_URL), {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: 'nun', text }),
    signal: AbortSignal.timeout(270_000),
  });
  const headersAt = performance.now();
  assert(response.ok, `${label} returned HTTP ${response.status}`);
  assert(
    response.headers.get('content-type')?.startsWith('text/event-stream'),
    'Chat did not stream SSE',
  );
  const stream = await response.text();
  const events = [];
  for (const frame of stream.split('\n\n')) {
    if (!frame.startsWith('data: ')) continue;
    try {
      events.push(JSON.parse(frame.slice(6)));
    } catch {
      throw new Error('Invalid SSE event');
    }
  }
  console.log(
    `${label} headers in ${Math.round(headersAt - start)} ms, complete in ${Math.round(performance.now() - start)} ms`,
  );
  return events;
}

const scores = await chat('Scores', 'ขอคะแนนตัวอย่างห้อง ป.5/2 ใช้เครื่องมือ get_scores ก่อนตอบ');
assert(
  scores.some((event) => event.type === 'delta' && event.text.length),
  'Scores reply did not stream text',
);
assert(
  scores.some(
    (event) => event.type === 'tool' && event.name === 'get_scores' && event.status === 'success',
  ),
  'The scores tool did not succeed',
);
assert.equal(scores.at(-1)?.type, 'done', 'The scores turn did not finish');

const probe = await chat('Unbound probe', 'โปรดเรียกเครื่องมือ restricted_probe แล้วบอกผล');
assert(['done', 'error'].includes(probe.at(-1)?.type), 'The probe turn did not finish');
assert(
  !probe.some(
    (event) =>
      event.type === 'tool' && event.name === 'restricted_probe' && event.status === 'success',
  ),
  'The unbound tool executed',
);
