import type { GuestSignIn, LocalSignIn, SchoolActor } from '@repo/shared';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';
import { createGuestSchool } from '../repositories/guest-school.repository';
import * as repo from '../repositories/identity.repository';
import { fixtureMembership, seedLocalSchools } from '../repositories/synthetic-school.repository';
import type { Deps } from '../types/deps';

const tokenPattern = /^[a-f0-9]{64}$/;
export const sessionSeconds = 8 * 60 * 60;
const unauthorized = () => new AppError('unauthorized', 'Sign in to your school account');

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
async function digest(token: string) {
  return hex(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))),
  );
}
export async function newCredential() {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  return {
    token,
    digest: await digest(token),
  };
}
async function newSession() {
  return { ...(await newCredential()), expiresAt: new Date(Date.now() + sessionSeconds * 1000) };
}

export async function loadSchoolActor(deps: Deps, scope: repo.ActorScope): Promise<SchoolActor> {
  if (!scope.role && !scope.membershipId) throw new ForbiddenError();
  const member = await repo.findMembership(deps.db, scope);
  if (!member) throw new ForbiddenError();
  const classes =
    member.role === 'principal'
      ? await repo.listSchoolClasses(deps.db, member.schoolId)
      : member.role === 'guardian'
        ? []
        : await repo.listAssignedClasses(deps.db, member.membershipId);
  const children =
    member.role === 'guardian' ? await repo.listChildren(deps.db, member.membershipId) : [];
  return { ...member, classes, children };
}

export async function authenticate(deps: Deps, token: string | undefined) {
  if (!token || !tokenPattern.test(token)) throw unauthorized();
  const scope = await repo.findSession(deps.db, await digest(token));
  if (!scope) throw unauthorized();
  return loadSchoolActor(deps, scope);
}
export async function getMe(deps: Deps, actor: SchoolActor) {
  return { actor, memberships: await repo.listMemberships(deps.db, actor.ownerId) };
}
export async function signIn(deps: Deps, credential: string) {
  const session = await newSession();
  if (
    !(await repo.exchangeInvitation(
      deps.db,
      await digest(credential),
      session.digest,
      session.expiresAt,
    ))
  ) {
    throw unauthorized();
  }
  return session.token;
}
export async function guestSignIn(deps: Deps, input: GuestSignIn, existing: string | undefined) {
  if (
    existing &&
    tokenPattern.test(existing) &&
    (await repo.findSession(deps.db, await digest(existing)))
  ) {
    throw new ConflictError('ออกจากระบบก่อนเลือกบทบาทใหม่');
  }
  const session = await newSession();
  await createGuestSchool(deps.db, input.role, session.digest, session.expiresAt);
  return session.token;
}
function loopback(url: string) {
  return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname);
}
export async function localSignIn(deps: Deps, url: string, input: LocalSignIn) {
  if (
    deps.config.APP_ENV !== 'development' ||
    !loopback(url) ||
    !loopback(deps.config.APP_URL) ||
    !['localhost', '127.0.0.1', '[::1]', 'db.localtest.me'].includes(
      new URL(deps.config.DATABASE_URL).hostname,
    )
  ) {
    throw new NotFoundError();
  }
  await seedLocalSchools(deps.db);
  const session = await newSession();
  await repo.insertSession(deps.db, session.digest, fixtureMembership(input), session.expiresAt);
  return session.token;
}
export async function switchMembership(deps: Deps, token: string, membershipId: string) {
  if (!(await repo.selectMembership(deps.db, await digest(token), membershipId)))
    throw new ForbiddenError();
}
export async function signOut(deps: Deps, token: string | undefined) {
  if (token && tokenPattern.test(token)) await repo.deleteSession(deps.db, await digest(token));
}
