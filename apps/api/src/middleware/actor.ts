import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from '../lib/errors';
import { authenticate } from '../services/identity.service';
import type { AppEnv } from '../types/app';

export function sessionCookieName(c: Context<AppEnv>) {
  return c.var.deps.config.APP_ENV === 'development' ? 'school_session' : '__Host-school_session';
}
export function readSessionCookie(c: Context<AppEnv>) {
  return getCookie(c, sessionCookieName(c));
}

// Browsers may send cookies for same-site sibling origins. Reject those writes too.
export function checkSchoolOrigin(c: Context<AppEnv>) {
  const origin = c.req.header('origin');
  if (
    origin &&
    origin !== new URL(c.req.url).origin &&
    origin !== new URL(c.var.deps.config.APP_URL).origin
  ) {
    throw new ForbiddenError();
  }
}
export const actorMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.header('Cache-Control', 'private, no-store');
  if (!['GET', 'HEAD'].includes(c.req.method)) checkSchoolOrigin(c);
  c.set('actor', await authenticate(c.var.deps, readSessionCookie(c)));
  await next();
});
