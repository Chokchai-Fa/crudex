import {
  briefDateSchema,
  routineSchema,
  routineUpdateSchema,
  saveWorksheetSchema,
  submissionSchema,
} from '@repo/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../lib/validate';
import { actorMiddleware } from '../middleware/actor';
import * as classroom from '../services/classroom.service';
import type { AppEnv } from '../types/app';

const bearer = (header?: string) => header?.match(/^Bearer ([a-f0-9-]+)$/)?.[1] ?? '';
const idParam = validate('param', z.object({ id: z.uuid() }));
export const classroomRoutes = new Hono<AppEnv>()
  .get('/classes/:id/gradebook', actorMiddleware, idParam, async (c) =>
    c.json(await classroom.gradebook(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .get('/assessments/:id', actorMiddleware, idParam, async (c) =>
    c.json(await classroom.worksheet(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .get('/play/:id', actorMiddleware, idParam, async (c) =>
    c.json(await classroom.quiz(c.var.deps, c.var.actor, c.req.valid('param').id)),
  )
  .post('/play/:id', actorMiddleware, idParam, validate('json', submissionSchema), async (c) =>
    c.json(
      await classroom.submit(
        c.var.deps,
        c.var.actor,
        c.req.valid('param').id,
        c.req.valid('json').answers,
      ),
    ),
  )
  .get('/routines', actorMiddleware, async (c) =>
    c.json(await classroom.routineList(c.var.deps, c.var.actor)),
  )
  .post('/routines', actorMiddleware, validate('json', routineSchema), async (c) =>
    c.json(await classroom.schedule(c.var.deps, c.var.actor, c.req.valid('json')), 201),
  )
  .patch(
    '/routines/:id',
    actorMiddleware,
    idParam,
    validate('json', routineUpdateSchema),
    async (c) =>
      c.json(
        await classroom.updateSchedule(
          c.var.deps,
          c.var.actor,
          c.req.valid('param').id,
          c.req.valid('json').enabled,
        ),
      ),
  )
  .get('/reports', actorMiddleware, async (c) =>
    c.json(await classroom.reportList(c.var.deps, c.var.actor)),
  )
  .get('/briefs/morning', actorMiddleware, validate('query', briefDateSchema), async (c) =>
    c.json(await classroom.brief(c.var.deps, c.var.actor, c.req.valid('query').date)),
  )
  .post(
    '/internal/runs/:id/tools/save_assessment',
    idParam,
    validate('json', saveWorksheetSchema),
    async (c) =>
      c.json(
        await classroom.saveWorksheet(
          c.var.deps,
          c.req.valid('param').id,
          bearer(c.req.header('authorization')),
          c.req.valid('json'),
        ),
      ),
  )
  .post(
    '/internal/runs/:id/tools/publish_brief',
    idParam,
    validate('json', z.object({ text: z.string().min(1).max(4000) })),
    async (c) =>
      c.json(
        await classroom.publishBrief(
          c.var.deps,
          c.req.valid('param').id,
          bearer(c.req.header('authorization')),
          c.req.valid('json').text,
        ),
      ),
  )
  .post('/internal/runs/:id/tools/get_school_summary', idParam, async (c) =>
    c.json(
      await classroom.principalTool(
        c.var.deps,
        c.req.valid('param').id,
        bearer(c.req.header('authorization')),
        false,
      ),
    ),
  )
  .post('/internal/runs/:id/tools/teacher_activity', idParam, async (c) =>
    c.json(
      await classroom.principalTool(
        c.var.deps,
        c.req.valid('param').id,
        bearer(c.req.header('authorization')),
        true,
      ),
    ),
  )
  .post('/internal/runs/:id/tools/get_scores', idParam, async (c) =>
    c.json(
      await classroom.toolGradebook(
        c.var.deps,
        c.req.valid('param').id,
        bearer(c.req.header('authorization')),
      ),
    ),
  );
