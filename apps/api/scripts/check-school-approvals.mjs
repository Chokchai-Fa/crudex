// Run against a local Worker and a migrated local database; all records are synthetic.
import assert from 'node:assert/strict';
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:8787/api/');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Local Worker required');

async function call(path, cookie, body) {
  const response = await fetch(new URL(path, base), {
    method: body ? 'POST' : 'GET',
    headers: { ...(cookie && { cookie }), ...(body && { 'content-type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const payload = await response.json();
  return {
    status: response.status,
    payload,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
async function login(role, school = 'lotus', account = 1) {
  const res = await call('auth/local', undefined, { role, school, account });
  assert.equal(res.status, 200, JSON.stringify(res.payload));
  return res.cookie;
}
const teacher = await login('teacher');
const peer = await login('teacher', 'lotus', 2);
const principal = await login('principal');
const outsider = await login('principal', 'river');
const input = {
  clientRequestId: crypto.randomUUID(),
  purpose: 'Synthetic classroom supplies',
  budgetCode: 'TEST',
  date: '2026-11-21',
  items: [{ name: 'Sample notebook', quantity: 3, unitPriceSatang: 1250 }],
};
const submissions = await Promise.all(
  Array.from({ length: 5 }, () => call('approvals', teacher, input)),
);
assert(
  submissions.every((s) => s.status === 201),
  JSON.stringify(submissions.map((s) => s.status)),
);
const id = submissions[0].payload.id;
assert(submissions.every((s) => s.payload.id === id && s.payload.totalSatang === 3750));
assert.equal((await call('approvals', teacher, { ...input, purpose: 'Changed item' })).status, 409);
const path = 'approvals/' + id;
assert.equal((await call(path, peer)).status, 404);
assert.equal((await call(path, outsider)).status, 404);
assert.equal((await call(path + '/decision', outsider, { decision: 'approve' })).status, 404);
assert.equal((await call(path + '/decision', teacher, { decision: 'approve' })).status, 403);
const choices = [
  { decision: 'approve' },
  { decision: 'return', reason: 'Synthetic missing receipt' },
];
const decisions = await Promise.all(choices.map((c) => call(path + '/decision', principal, c)));
assert.deepEqual(decisions.map((d) => d.status).sort(), [200, 409]);
const winningIndex = decisions.findIndex((d) => d.status === 200);
assert.equal((await call(path + '/decision', principal, choices[winningIndex])).status, 200);
for (const channel of ['teacher', 'budget_assistant']) {
  const notes = await call('approval-notifications?channel=' + channel, teacher);
  assert.equal(notes.status, 200);
  assert.equal(notes.payload.notifications.filter((n) => n.claimId === id).length, 1);
  const otherNotes = await call('approval-notifications?channel=' + channel, peer);
  assert.equal(otherNotes.payload.notifications.filter((n) => n.claimId === id).length, 0);
}
console.log(
  'Concurrent teacher submission, school and owner isolation, competing decisions, idempotent replay and exactly-once notifications passed.',
);
