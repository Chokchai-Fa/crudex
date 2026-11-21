import { Hono } from 'hono';
import { z } from 'zod';
import { memoryTextSchema } from '@repo/shared';
import { actorMiddleware } from '../middleware/actor';
import { validate } from '../lib/validate';
import * as service from '../services/memory.service';
import type { AppEnv } from '../types/app';
const id = z.object({ id: z.uuid() });
const token = (header?: string) => header?.match(/^Bearer ([a-f0-9-]+)$/)?.[1] ?? '';
export const memoryRoutes = new Hono<AppEnv>()
  .get('/memories', actorMiddleware, async (c) =>
    c.json(await service.approvedMemories(c.var.deps, c.var.actor)),
  )
  .delete('/memories/:id', actorMiddleware, validate('param', id), async (c) => {
    await service.forget(c.var.deps, c.var.actor, c.req.valid('param').id);
    return c.body(null, 204);
  })
  .get('/runs/:id/memory', actorMiddleware, validate('param', id), async (c) =>
    c.json(await service.listProposals(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .post(
    '/runs/:id/memory/:proposalId/approve',
    actorMiddleware,
    validate('param', id.extend({ proposalId: z.uuid() })),
    async (c) =>
      c.json(
        await service.approveProposal(
          c.var.deps,
          c.var.actor,
          c.req.valid('param').id,
          c.req.valid('param').proposalId,
        ),
      ),
  )
  .post(
    '/internal/runs/:id/tools/memory_save',
    validate('param', id),
    validate('json', z.strictObject({ text: memoryTextSchema, userConfirmed: z.boolean() })),
    async (c) =>
      c.json(
        await service.proposeMemory(
          c.var.deps,
          c.req.valid('param').id,
          token(c.req.header('Authorization')),
          c.req.valid('json').text,
        ),
      ),
  )
  .post(
    '/internal/runs/:id/tools/memory_search',
    validate('param', id),
    validate(
      'json',
      z.strictObject({ query: z.string().max(2048), limit: z.int().min(1).max(10).default(5) }),
    ),
    async (c) =>
      c.json(
        await service.searchMemory(
          c.var.deps,
          c.req.valid('param').id,
          token(c.req.header('Authorization')),
          c.req.valid('json').query,
          c.req.valid('json').limit,
        ),
      ),
  );
