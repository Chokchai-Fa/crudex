// Run against the migrated local Compose stack and local Worker. Creates only synthetic test rows.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import pg from 'pg';

const api = new URL(process.argv[2] ?? 'http://localhost:8787/api/');
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/main';
const local = (host) => ['localhost', '127.0.0.1', '[::1]', 'db.localtest.me'].includes(host);
assert(local(api.hostname) && local(new URL(databaseUrl).hostname), 'Local services required');
async function request(path, method = 'GET', body, cookie) {
  return fetch(new URL(path, api), {
    method,
    headers: {
      ...(body && { 'content-type': 'application/json' }),
      ...(cookie && { cookie }),
    },
    body: body && JSON.stringify(body),
  });
}
async function localActor(role, school, account = 1) {
  const res = await request('auth/local', 'POST', { school, role, account });
  assert.equal(res.status, 200, await res.clone().text());
  return (await res.json()).actor;
}

const teacher = await localActor('teacher', 'lotus');
const colleague = await localActor('teacher', 'lotus', 2);
const other = await localActor('teacher', 'river');
assert.notEqual(teacher.classes[0].id, colleague.classes[0].id);
assert.notEqual(teacher.schoolId, other.schoolId);
const guardian = await localActor('guardian', 'lotus', 2);
assert.equal(guardian.children.length, 2);
const guardianChild = await localActor('student', 'lotus');
assert(guardian.children.some((child) => child.id === guardianChild.ownerId));
const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();
const account = randomUUID();
try {
  await db.query('INSERT INTO school_accounts (id,display_name) VALUES ($1,$2)', [
    account,
    'Integration fixture',
  ]);
  const member = (
    await db.query(
      "INSERT INTO school_memberships (owner_id,school_id,role) VALUES ($1,$2,'teacher') RETURNING id",
      [account, teacher.schoolId],
    )
  ).rows[0].id;
  const secondMember = (
    await db.query(
      "INSERT INTO school_memberships (owner_id,school_id,role) VALUES ($1,$2,'guardian') RETURNING id",
      [account, other.schoolId],
    )
  ).rows[0].id;
  const credential = randomBytes(32).toString('hex');
  await db.query(
    "INSERT INTO school_invitations (membership_id,digest,expires_at) VALUES ($1,$2,now()+interval '5 minutes')",
    [member, createHash('sha256').update(credential).digest('hex')],
  );
  const attempts = await Promise.all(
    [1, 2].map(() => request('auth/session', 'POST', { credential })),
  );
  assert.deepEqual(attempts.map((r) => r.status).sort(), [200, 401]);
  const cookie = attempts
    .find((r) => r.ok)
    .headers.get('set-cookie')
    .split(';')[0];
  assert.equal((await request('me', 'GET', undefined, cookie)).status, 200);
  assert.equal(
    (await request('auth/membership', 'POST', { membershipId: other.membershipId }, cookie)).status,
    403,
  );
  const switched = await request('auth/membership', 'POST', { membershipId: secondMember }, cookie);
  assert.equal(switched.status, 200);
  const next = await switched.json();
  assert.deepEqual(next.memberships.map((m) => m.id).sort(), [member, secondMember].sort());
  assert.equal(next.actor.schoolId, other.schoolId);
  assert.equal(next.actor.role, 'guardian');
  await db.query(
    "UPDATE school_memberships SET expires_at = now() - interval '1 second' WHERE id = $1",
    [secondMember],
  );
  assert.equal((await request('me', 'GET', undefined, cookie)).status, 401);
  console.log(
    'School identity passed: two schools, two teachers, guardian mapping, single-use invite, membership isolation and expiry.',
  );
} finally {
  await db.query(
    'DELETE FROM school_sessions WHERE membership_id IN (SELECT id FROM school_memberships WHERE owner_id=$1)',
    [account],
  );
  await db.query(
    'DELETE FROM school_invitations WHERE membership_id IN (SELECT id FROM school_memberships WHERE owner_id=$1)',
    [account],
  );
  await db.query('DELETE FROM school_memberships WHERE owner_id=$1', [account]);
  await db.query('DELETE FROM school_accounts WHERE id=$1', [account]);
  await db.end();
}
