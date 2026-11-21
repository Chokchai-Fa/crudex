import { credentialSchema, localSignInSchema, selectMembershipSchema } from '@repo/shared';
import { type Context, Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { validate } from '../lib/validate';
import {
  actorMiddleware,
  checkSchoolOrigin,
  readSessionCookie,
  sessionCookieName,
} from '../middleware/actor';
import {
  authenticate,
  getMe,
  localSignIn,
  sessionSeconds,
  signIn,
  signOut,
  switchMembership,
} from '../services/identity.service';
import type { AppEnv } from '../types/app';

function cookieOptions(c: Context<AppEnv>) {
  return {
    path: '/',
    secure: c.var.deps.config.APP_ENV !== 'development',
    httpOnly: true,
    sameSite: 'Strict' as const,
  };
}
async function signedIn(c: Context<AppEnv>, token: string) {
  const actor = await authenticate(c.var.deps, token);
  setCookie(c, sessionCookieName(c), token, { ...cookieOptions(c), maxAge: sessionSeconds });
  return c.json(await getMe(c.var.deps, actor));
}

export const meRoutes = new Hono<AppEnv>()
  .use('/auth/*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    checkSchoolOrigin(c);
    await next();
  })
  .get('/me', actorMiddleware, async (c) => c.json(await getMe(c.var.deps, c.var.actor)))
  .post('/auth/session', validate('json', credentialSchema), async (c) =>
    signedIn(c, await signIn(c.var.deps, c.req.valid('json').credential)),
  )
  .post('/auth/local', validate('json', localSignInSchema), async (c) =>
    signedIn(c, await localSignIn(c.var.deps, c.req.url, c.req.valid('json'))),
  )
  .post(
    '/auth/membership',
    actorMiddleware,
    validate('json', selectMembershipSchema),
    async (c) => {
      const token = readSessionCookie(c)!;
      await switchMembership(c.var.deps, token, c.req.valid('json').membershipId);
      return c.json(await getMe(c.var.deps, await authenticate(c.var.deps, token)));
    },
  )
  .delete('/auth/session', async (c) => {
    await signOut(c.var.deps, readSessionCookie(c));
    deleteCookie(c, sessionCookieName(c), cookieOptions(c));
    return c.body(null, 204);
  });
