// Run with tsx against a migrated local Neon HTTP proxy and a synthetic actor.
// The check reserves one daily quota slot and leaves the completed synthetic run for replay.
import assert from 'node:assert/strict';
import { createDb } from '../src/db/client';
import * as memory from '../src/repositories/memory.repository';
import * as repo from '../src/repositories/runs.repository';
import { sql } from 'drizzle-orm';
import type { SchoolActor } from '@repo/shared';

const url = process.env.LOCAL_RUN_TEST_DATABASE_URL;
if (!url || !['db.localtest.me', 'localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Set LOCAL_RUN_TEST_DATABASE_URL to a migrated local database');
const db = createDb(url);
const a: SchoolActor = {
  ownerId: crypto.randomUUID(),
  membershipId: crypto.randomUUID(),
  schoolId: crypto.randomUUID(),
  role: 'teacher',
  displayName: 'Synthetic teacher',
  classes: [],
  children: [],
};
const input = { clientRequestId: crypto.randomUUID(), prompt: 'synthetic worksheet' };
const accepted = await Promise.all(
  Array.from({ length: 8 }, () => repo.accept(db, a, 'teacher', 'jum', input)),
);
const id = accepted[0]!.id;
assert(accepted.every((run) => run.id === id));
assert.deepEqual(
  (await db.execute(sql`select count(*)::int as n from run_outbox where run_id=${id}`)).rows,
  [{ n: 1 }],
);
const winners = await Promise.all(
  Array.from({ length: 8 }, () => repo.claim(db, id, crypto.randomUUID(), 'synthetic')),
);
assert.equal(winners.filter(Boolean).length, 1);
const attempt = winners.find(Boolean)!.attemptId!;
await repo.append(db, id, attempt, [
  { type: 'delta', text: 'one' },
  { type: 'delta', text: 'two' },
]);
await memory.propose(db, a, id, attempt, 'Use larger print');
const [proposal] = await memory.proposals(db, a, id);
assert(proposal && !proposal.approved);
assert.equal((await memory.search(db, a, 'print', 5)).length, 0);
assert.equal(
  (await memory.approve(db, { ...a, ownerId: crypto.randomUUID() }, id, proposal.id)).length,
  0,
);
assert.equal((await memory.approve(db, a, id, proposal.id)).length, 1);
assert.equal((await memory.approve(db, a, id, proposal.id)).length, 0);
assert.deepEqual(
  (await memory.search(db, a, 'print', 5)).map((r) => r.text),
  ['Use larger print'],
);
await memory.removeApproved(db, a, proposal.id);
assert.equal((await memory.search(db, a, 'print', 5)).length, 0);
console.log('Owner-scoped one-use approval, memory search and deletion passed.');

await repo.finish(db, id, attempt, 'succeeded', { type: 'done', elapsedMs: 10 });
await repo.append(db, id, attempt, [{ type: 'error', code: 'stale' }]);
const events = await repo.events(db, id, 0);
assert.deepEqual(
  events.map((e) => e.body.type),
  ['status', 'status', 'delta', 'delta', 'approval', 'done'],
);
assert.deepEqual(
  (await repo.events(db, id, events[1]!.id)).map((e) => e.id),
  events.slice(2).map((e) => e.id),
);
assert.equal(await repo.owned(db, { ...a, ownerId: crypto.randomUUID() }, id), undefined);
assert.deepEqual(
  (await repo.history(db, a, 'jum')).map((r) => r.id),
  [id],
);
console.log('Concurrent acceptance, exclusive claim, ordered replay and owner isolation passed.');

const used = await db.execute(sql`select used from owner_run_quota where owner_id=${a.ownerId}`);
assert.deepEqual(used.rows, [{ used: 1 }]);
const denied = { ...a, ownerId: crypto.randomUUID() };
await db.execute(
  sql`insert into owner_run_quota(day,owner_id,used) values((now() at time zone 'Asia/Bangkok')::date,${denied.ownerId},20)`,
);
await assert.rejects(repo.accept(db, denied, 'teacher', 'jum', input), (e) =>
  String(e).includes('daily_run_limit'),
);
assert.equal((await repo.history(db, denied, 'jum')).length, 0);
console.log('One quota reservation on replay and atomic rollback at the owner limit passed.');
