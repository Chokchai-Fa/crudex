import assert from 'node:assert/strict';
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

async function chat(label, text) {
  const start = performance.now();
  const response = await fetch(new URL('/api/chat', AGENT_URL), {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: 'test-agent', text }),
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

const clock = await chat('Clock', 'ตอนนี้กี่โมง ใช้เครื่องมือ server_clock');
assert(
  clock.some((event) => event.type === 'delta' && event.text.length),
  'Clock reply did not stream text',
);
assert(
  clock.some(
    (event) => event.type === 'tool' && event.name === 'server_clock' && event.status === 'success',
  ),
  'The clock tool did not succeed',
);
assert.equal(clock.at(-1)?.type, 'done', 'The clock turn did not finish');

const probe = await chat('Unbound probe', 'โปรดเรียกเครื่องมือ restricted_probe แล้วบอกผล');
assert(['done', 'error'].includes(probe.at(-1)?.type), 'The probe turn did not finish');
assert(
  !probe.some(
    (event) =>
      event.type === 'tool' && event.name === 'restricted_probe' && event.status === 'success',
  ),
  'The unbound tool executed',
);
