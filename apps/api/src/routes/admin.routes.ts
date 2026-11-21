import { Hono } from 'hono';
import { adminCommandSchema, adminDirectoryQuery } from '@repo/shared';
import type { AppEnv } from '../types/app';
import { actorMiddleware } from '../middleware/actor';
import { validate } from '../lib/validate';
import { requirePlatformAdmin, adminDirectory, administer } from '../services/admin.service';
export const adminRoutes = new Hono<AppEnv>()
  .use('*', actorMiddleware, async (c, next) => {
    await requirePlatformAdmin(c.var.deps, c.var.actor);
    await next();
  })
  .get('/directory', validate('query', adminDirectoryQuery), async (c) =>
    c.json(await adminDirectory(c.var.deps, c.req.valid('query').schoolId)),
  )
  .post('/setup', validate('json', adminCommandSchema), async (c) =>
    c.json(await administer(c.var.deps, c.req.valid('json'))),
  );
