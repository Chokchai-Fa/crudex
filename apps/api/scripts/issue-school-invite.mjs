// Run with DATABASE_URL already configured. The output file is created privately and exclusively.
import { createHash, randomBytes } from 'node:crypto';
import { open, unlink } from 'node:fs/promises';
import pg from 'pg';

const [membershipId, outputPath] = process.argv.slice(2);
if (!process.env.DATABASE_URL || !/^[a-f0-9-]{36}$/i.test(membershipId ?? '') || !outputPath) {
  throw new Error(
    'Set DATABASE_URL and supply a membership UUID and a new private output file path',
  );
}
const credential = randomBytes(32).toString('hex');
const digest = createHash('sha256').update(credential).digest('hex');
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const file = await open(outputPath, 'wx', 0o600);
try {
  await db.connect();
  await file.writeFile(credential + '\n');
  const result = await db.query(
    `INSERT INTO school_invitations (digest, membership_id, expires_at)
     SELECT $1, id, now() + interval '15 minutes' FROM school_memberships
     WHERE id = $2 AND (expires_at IS NULL OR expires_at > now())`,
    [digest, membershipId],
  );
  if (result.rowCount !== 1) throw new Error('Active school membership required');
} catch (error) {
  await unlink(outputPath);
  throw error;
} finally {
  await file.close();
  await db.end();
}
