import { createNoteSchema, noteIdParamSchema } from '@repo/shared';
import { Hono } from 'hono';
import { validate } from '../lib/validate';
import { createNote, deleteNote, listNotes } from '../services/notes.service';
import type { AppEnv } from '../types/app';

// HTTP only: validate input, call a service with c.var.deps, return JSON.
export const notesRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await listNotes(c.var.deps)))
  .post('/', validate('json', createNoteSchema), async (c) => {
    const note = await createNote(c.var.deps, c.req.valid('json'));
    return c.json(note, 201);
  })
  .delete('/:id', validate('param', noteIdParamSchema), async (c) => {
    await deleteNote(c.var.deps, c.req.valid('param').id);
    return c.body(null, 204);
  });
