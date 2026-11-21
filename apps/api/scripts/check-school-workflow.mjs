// Start the API with the local dispatch fixture (see README), against a disposable migrated DB.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const origin = new URL(process.argv[2] ?? 'http://127.0.0.1:8790');
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/main';
assert(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname));
assert(
  ['localhost', 'db.localtest.me', '127.0.0.1', '[::1]'].includes(new URL(databaseUrl).hostname),
);
async function call(path, { session, method = 'GET', body, headers = {}, status = 200 } = {}) {
  const response = await fetch(new URL(path, origin), {
    method,
    headers: {
      ...(session && { cookie: session.cookie }),
      ...(body && { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body && JSON.stringify(body),
  });
  assert.equal(
    response.status,
    status,
    path + ' returned ' + response.status + ': ' + (await response.clone().text()),
  );
  return response;
}
async function signIn(role, school = 'lotus', account = 1) {
  const response = await call('/api/auth/local', {
    method: 'POST',
    body: { role, school, account },
  });
  return { cookie: response.headers.get('set-cookie').split(';')[0], ...(await response.json()) };
}
async function until(description, read) {
  const deadline = Date.now() + 45_000;
  do {
    const result = await read();
    if (result) return result;
    await delay(250);
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for ' + description);
}
const teacher = await signIn('teacher');
const student = await signIn('student');
const outside = await signIn('student', 'river');
const colleague = await signIn('teacher', 'lotus', 2);
const principal = await signIn('principal');
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
try {
  const classId = teacher.actor.classes[0].id;
  const question = {
    clientRequestId: randomUUID(),
    classId,
    prompt: 'Can you explain equivalent fractions?',
  };
  const chat = () =>
    call('/api/agents/jaew/chat', { method: 'POST', session: teacher, body: question });
  const conversation = await chat();
  assert.match(conversation.headers.get('content-type'), /application\/x-ndjson/);
  const conversationId = conversation.headers.get('x-run-id');
  const events = (await conversation.text())
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert(events.some((e) => e.type === 'delta' && e.text === 'One half equals two quarters.'));
  assert.equal(events.at(-1).type, 'done');
  assert.equal((await (await chat()).json()).id, conversationId);
  await call('/api/runs/' + conversationId + '/events', { session: colleague, status: 404 });
  assert.match(
    await (await call('/api/runs/' + conversationId + '/events', { session: teacher })).text(),
    /two quarters/,
  );
  const submit = { clientRequestId: randomUUID(), prompt: 'ช่วยสร้างแบบฝึกหัดเศษส่วน', classId };
  const postRun = async () =>
    (
      await call('/api/agents/jaew/runs', {
        session: teacher,
        method: 'POST',
        body: submit,
        status: 202,
      })
    ).json();
  const [first, repeated] = await Promise.all([postRun(), postRun()]);
  assert.equal(first.id, repeated.id);
  await call('/api/agents/jaew/runs', {
    method: 'POST',
    session: teacher,
    body: { ...submit, prompt: 'changed' },
    status: 409,
  });
  const frames = await until('completed worksheet stream', async () => {
    const text = await (
      await call('/api/runs/' + first.id + '/events', { session: teacher })
    ).text();
    if (text.includes('"type":"error"')) throw new Error('Run failed: ' + text);
    return text.includes('"type":"done"') && text;
  });
  const ids = [...frames.matchAll(/^id: (\d+)/gm)].map((x) => Number(x[1]));
  assert(ids.length >= 4);
  const resumed = await (
    await call('/api/runs/' + first.id + '/events', {
      session: teacher,
      headers: { 'Last-Event-ID': String(ids.at(-2)) },
    })
  ).text();
  assert.deepEqual(
    [...resumed.matchAll(/^id: (\d+)/gm)].map((x) => Number(x[1])),
    ids.slice(-1),
  );
  await call('/api/runs/' + first.id + '/events', { session: colleague, status: 404 });
  const artifacts = await db.query('SELECT id,play_token FROM assessments WHERE run_id=$1', [
    first.id,
  ]);
  assert.equal(artifacts.rowCount, 1);
  const { id, play_token: playToken } = artifacts.rows[0];
  for (const agent of ['jaew', 'jum']) {
    const history = await (
      await call('/api/agents/' + agent + '/history', { session: teacher })
    ).json();
    assert(history.runs.some((run) => run.id === first.id && run.worksheetIds.includes(id)));
  }
  assert.equal(
    (await (await call('/api/assessments/' + id, { session: teacher })).json()).questions[0]
      .correctChoiceId,
    'a',
  );
  await call('/api/assessments/' + id, { session: colleague, status: 403 });
  await call('/api/play/' + playToken, { session: outside, status: 404 });
  const quiz = await (await call('/api/play/' + playToken, { session: student })).json();
  assert(!('correctChoiceId' in quiz.questions[0]));
  for (let i = 0; i < 2; i++) {
    const result = await (
      await call('/api/play/' + playToken, {
        method: 'POST',
        session: student,
        body: { answers: { q1: 'a' } },
      })
    ).json();
    assert.equal(result.score, 1);
  }
  await call('/api/play/' + playToken, {
    method: 'POST',
    session: student,
    body: { answers: { q1: 'b' } },
    status: 409,
  });
  const gradebook = await (
    await call('/api/classes/' + classId + '/gradebook', { session: teacher })
  ).json();
  assert(gradebook.students.some((s) => s.id === student.actor.membershipId && s.score >= 1));
  await call('/api/classes/' + classId + '/gradebook', { session: colleague, status: 403 });
  const prior = await (await call('/api/briefs/morning', { session: principal })).json();
  // Allocate an unused schedule time in this synthetic classroom so the suite can be repeated.
  const slot = await db.query(
    `SELECT n/60 AS hour,n%60 AS minute FROM generate_series(0,1439) n
    WHERE NOT EXISTS (SELECT 1 FROM school_routines r WHERE teacher_id=$1 AND class_id=$2 AND hour=n/60 AND minute=n%60)
    LIMIT 1`,
    [teacher.actor.membershipId, classId],
  );
  const routine = await (
    await call('/api/routines', {
      method: 'POST',
      session: teacher,
      body: { classId, ...slot.rows[0] },
      status: 201,
    })
  ).json();
  await db.query(
    "UPDATE school_routines SET next_run_at=date_trunc('milliseconds',now()) WHERE id=$1",
    [routine.id],
  );
  const scheduledPath = '/cdn-cgi/handler/scheduled?cron=' + encodeURIComponent('*/5 * * * *');
  await call(scheduledPath);
  await until(
    'two guardian drafts',
    async () =>
      (
        await db.query("SELECT id FROM guardian_reports WHERE routine_id=$1 AND status='draft'", [
          routine.id,
        ])
      ).rowCount === 2,
  );
  await call(scheduledPath);
  const brief = await (await call('/api/briefs/morning', { session: principal })).json();
  assert(brief.reports >= prior.reports + 2);
  const recipients = await db.query(
    'SELECT DISTINCT guardian_id, student_id FROM guardian_reports WHERE routine_id=$1',
    [routine.id],
  );
  assert.equal(recipients.rowCount, 2);
  assert(recipients.rows.every((r) => r.student_id === student.actor.membershipId));
  const guardians = [await signIn('guardian'), await signIn('guardian', 'lotus', 2)];
  const draftRows = await db.query(
    'SELECT id,guardian_id FROM guardian_reports WHERE routine_id=$1',
    [routine.id],
  );
  const visible = async (session) =>
    (await (await call('/api/reports', { session })).json()).reports.map((r) => r.id);
  for (const guardian of guardians) {
    const inbox = await visible(guardian);
    assert(draftRows.rows.every((r) => !inbox.includes(r.id)));
  }
  // Simulate an externally confirmed delivery solely in the disposable database.
  await db.query("UPDATE guardian_reports SET status='sent' WHERE routine_id=$1", [routine.id]);
  for (const guardian of guardians) {
    const inbox = await visible(guardian);
    for (const row of draftRows.rows)
      assert.equal(inbox.includes(row.id), row.guardian_id === guardian.actor.membershipId);
  }

  await call('/api/routines/' + routine.id, {
    method: 'PATCH',
    session: teacher,
    body: { enabled: false },
  });
  console.log(
    'School workflow passed: direct conversation, idempotent retry, conversation replay, concurrent acceptance, verified worksheet callback, SSE replay, scoped history, quiz grading, two guardian drafts, and principal brief.',
  );
} finally {
  await db.end();
}
