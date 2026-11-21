// Integration check against a migrated, disposable database and its local Worker.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
const origin = new URL(process.argv[2] ?? 'http://localhost:8787');
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/main';
const loopback = (host) => ['localhost', '127.0.0.1', '[::1]', 'db.localtest.me'].includes(host);
assert(
  loopback(origin.hostname) && loopback(new URL(databaseUrl).hostname),
  'Local environments only',
);
const db = new pg.Client({ connectionString: databaseUrl });
async function request(path, payload, cookie, status = 200) {
  const r = await fetch(new URL('/api/' + path, origin), {
    method: payload ? 'POST' : 'GET',
    headers: { ...(payload && { 'content-type': 'application/json' }), ...(cookie && { cookie }) },
    body: payload && JSON.stringify(payload),
  });
  assert.equal(r.status, status, path + ' expected ' + status + ' got ' + r.status);
  return r;
}
async function session(credential) {
  const r = await request('auth/session', { credential });
  return { cookie: r.headers.get('set-cookie').split(';')[0], me: await r.json() };
}
await db.connect();
const admin = randomUUID(),
  membership = randomUUID(),
  school = randomUUID();
try {
  await db.query('begin');
  await db.query('insert into schools(id,name) values ($1,$2)', [school, 'Admin verification']);
  await db.query('insert into school_accounts(id,display_name) values($1,$2)', [
    admin,
    'Admin verification',
  ]);
  await db.query(
    "insert into school_memberships(id,owner_id,school_id,role) values($1,$2,$3,'principal')",
    [membership, admin, school],
  );
  await db.query('insert into platform_admins(account_id) values($1)', [admin]);
  const initial = randomBytes(32).toString('hex');
  await db.query(
    "insert into school_invitations(digest,membership_id,expires_at) values($1,$2,now()+interval '15 minutes')",
    [createHash('sha256').update(initial).digest('hex'), membership],
  );
  await db.query('commit');
  const { cookie } = await session(initial);
  const setup = async (c, status = 200) => (await request('admin/setup', c, cookie, status)).json();
  await request('admin/directory', undefined, undefined, 401);
  const schoolId = randomUUID(),
    classId = randomUUID(),
    secondClass = randomUUID();
  const newSchool = { action: 'createSchool', id: schoolId, name: 'Test campus' };
  await Promise.all([setup(newSchool), setup(newSchool)]);
  await setup({ ...newSchool, name: 'Another name' }, 409);
  for (const id of [classId, secondClass])
    await setup({ action: 'createClass', schoolId, id, name: 'Room ' + id });
  const members = {};
  for (const role of ['teacher', 'student', 'guardian', 'principal']) {
    const accountId = randomUUID();
    await setup({ action: 'createAccount', id: accountId, name: 'Test ' + role });
    const placement =
      role === 'principal'
        ? { role }
        : role === 'guardian'
          ? { role, studentMembershipId: members.student }
          : { role, classId };
    const enrollment = { action: 'enroll', schoolId, accountId, placement };
    const first = await setup(enrollment);
    members[role] = first.id;
    assert.equal((await setup(enrollment)).id, first.id);
    if (role === 'teacher') {
      await setup({ ...enrollment, placement: { role, classId: secondClass } });
      await setup({ ...enrollment, schoolId: school }, 409);
    }
    if (role === 'guardian') await setup({ ...enrollment, schoolId: school }, 409);
    const invite = await setup({ action: 'invite', schoolId, membershipId: first.id });
    const signed = await session(invite.credential);
    assert.equal(signed.me.actor.role, role);
    assert.equal(signed.me.actor.schoolId, schoolId);
    if (role === 'guardian') assert.equal(signed.me.actor.children.length, 1);
    if (role === 'teacher') assert.equal(signed.me.actor.classes.length, 2);
    if (role === 'student') assert.equal(signed.me.actor.classes[0].id, classId);
    await request('admin/directory', undefined, signed.cookie, 403);
    await request('admin/setup', newSchool, signed.cookie, 403);
    await request('auth/session', { credential: invite.credential }, undefined, 401);
  }
  await setup({ action: 'invite', schoolId: school, membershipId: membership }, 404);
  const list = await (
    await request('admin/directory?schoolId=' + schoolId, undefined, cookie)
  ).json();
  assert.equal(list.members.length, 4);
  assert.equal(list.classes.length, 2);
  console.log(
    'Verified enrollment, repeat requests, role sign-in, class/guardian scope, single-use invitations and admin restrictions.',
  );
} finally {
  await db.query('rollback');
  await db.query('delete from platform_admins where account_id=$1', [admin]);
  await db.end();
}
