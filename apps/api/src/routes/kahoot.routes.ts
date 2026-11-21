import { schoolKahootCallbackPath, type SchoolActor, type SchoolKahootAccount } from '@repo/shared';
import { Hono } from 'hono';
import { ForbiddenError } from '../lib/errors';
import { actorMiddleware } from '../middleware/actor';
import type { AppEnv } from '../types/app';
import type { Deps } from '../types/deps';

function teacherAccount({ schoolId, ownerId, role }: SchoolActor): SchoolKahootAccount {
  if (role !== 'teacher') throw new ForbiddenError();
  return { schoolId, ownerId, role };
}

function gateway({ agentGateway }: Deps) {
  if (!agentGateway) throw new Error('Gateway unavailable');
  return agentGateway;
}

export const kahootRoutes = new Hono<AppEnv>()
  .get('/connect', actorMiddleware, async (c) => {
    const account = teacherAccount(c.var.actor);
    const redirectUri = new URL(schoolKahootCallbackPath, c.var.deps.config.APP_URL);
    const { url } = await gateway(c.var.deps).kahootConnect(account, redirectUri.href);
    return c.redirect(url, 303);
  })
  .get('/callback', async (c) => {
    const state = c.req.query('state');
    const code = c.req.query('error') === undefined ? (c.req.query('code') ?? null) : null;
    let ok = false;
    if (state) {
      try {
        ({ ok } = await gateway(c.var.deps).kahootCallback(state, code));
      } catch {
        ok = false;
      }
    }
    c.header('Cache-Control', 'no-store');
    c.header('Referrer-Policy', 'no-referrer');
    return c.redirect(ok ? '/?kahoot=connected' : '/?kahoot=failed', 303);
  })
  .get('/status', actorMiddleware, async (c) => {
    const account = teacherAccount(c.var.actor);
    return c.json(await gateway(c.var.deps).kahootStatus(account));
  })
  .post('/disconnect', actorMiddleware, async (c) => {
    const account = teacherAccount(c.var.actor);
    return c.json(await gateway(c.var.deps).kahootDisconnect(account));
  });
