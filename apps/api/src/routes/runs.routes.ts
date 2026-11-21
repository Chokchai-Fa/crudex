import { agentIdSchema, createRunSchema } from '@repo/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import { ValidationError } from '../lib/errors';
import { actorMiddleware } from '../middleware/actor';
import { cancelRun, replay, runHistory, startRun } from '../services/runs.service';
import type { AppEnv } from '../types/app';

const agentParam = z.object({ id: agentIdSchema });
export const runRoutes = new Hono<AppEnv>()
  .post(
    '/agents/:id/runs',
    actorMiddleware,
    validate('param', agentParam),
    validate('json', createRunSchema),
    async (c) =>
      c.json(
        await startRun(c.var.deps, c.var.actor, c.req.valid('param').id, c.req.valid('json')),
        202,
      ),
  )
  .get('/agents/:id/history', actorMiddleware, validate('param', agentParam), async (c) =>
    c.json(await runHistory(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .post(
    '/runs/:id/cancel',
    actorMiddleware,
    validate('param', z.object({ id: z.uuid() })),
    async (c) => c.json(await cancelRun(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .get(
    '/runs/:id/events',
    actorMiddleware,
    validate('param', z.object({ id: z.uuid() })),
    async (c) => {
      const cursor = Number(c.req.header('Last-Event-ID') ?? 0);
      if (!Number.isSafeInteger(cursor) || cursor < 0)
        throw new ValidationError('Invalid event cursor');
      const { events: rows, terminal } = await replay(
        c.var.deps,
        c.var.actor,
        c.req.valid('param').id,
        cursor,
      );
      if (terminal && !rows.length) return c.body(null, 204);
      const frames = rows
        .map(({ id, body }) => 'id: ' + id + '\ndata: ' + JSON.stringify(body) + '\n\n')
        .join('');
      return c.body('retry: ' + (rows.length === 128 ? '100' : '2500') + '\n\n' + frames, 200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-store, no-transform',
      });
    },
  );
