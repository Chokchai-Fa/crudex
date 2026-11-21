import {
  approvalIdSchema,
  budgetClaimSchema,
  claimDecisionSchema,
  getApprovalToolSchema,
} from '@repo/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { actorMiddleware } from '../middleware/actor';
import { validate } from '../lib/validate';
import * as service from '../services/approvals.service';
import type { AppEnv } from '../types/app';

const id = validate('param', approvalIdSchema);
const token = (header?: string) => header?.match(/^Bearer ([a-f0-9-]+)$/)?.[1] ?? '';
export const approvalRoutes = new Hono<AppEnv>()
  .post('/approvals', actorMiddleware, validate('json', budgetClaimSchema), async (c) =>
    c.json(await service.submitClaim(c.var.deps, c.var.actor, c.req.valid('json')), 201),
  )
  .get('/approvals', actorMiddleware, async (c) =>
    c.json(await service.listClaims(c.var.deps, c.var.actor)),
  )
  .get('/approvals/:id', actorMiddleware, id, async (c) =>
    c.json(await service.readClaim(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .post(
    '/approvals/:id/decision',
    actorMiddleware,
    id,
    validate('json', claimDecisionSchema),
    async (c) =>
      c.json(
        await service.decideClaim(
          c.var.deps,
          c.var.actor,
          c.req.valid('param').id,
          c.req.valid('json'),
        ),
      ),
  )
  .get(
    '/approval-notifications',
    actorMiddleware,
    validate(
      'query',
      z.object({ channel: z.enum(['teacher', 'budget_assistant']).default('teacher') }),
    ),
    async (c) =>
      c.json(
        await service.listNotifications(c.var.deps, c.var.actor, c.req.valid('query').channel),
      ),
  )
  .post('/internal/runs/:id/tools/list_pending_approvals', id, async (c) =>
    c.json(
      await service.pendingTool(
        c.var.deps,
        c.req.valid('param').id,
        token(c.req.header('Authorization')),
      ),
    ),
  )
  .post(
    '/internal/runs/:id/tools/get_approval',
    id,
    validate('json', getApprovalToolSchema),
    async (c) =>
      c.json(
        await service.detailTool(
          c.var.deps,
          c.req.valid('param').id,
          token(c.req.header('Authorization')),
          c.req.valid('json').approvalId,
        ),
      ),
  );
