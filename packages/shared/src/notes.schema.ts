import { z } from 'zod';

// Example feature — shows the full path shared schema → route → service → repository → db.
// Replace it with your own features (keep this file as a reference until then).

export const NOTE_TITLE_MAX = 200;
export const NOTE_BODY_MAX = 5_000;

/** `POST /api/notes` body. */
export const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give it a title')
    .max(NOTE_TITLE_MAX, `Keep the title under ${NOTE_TITLE_MAX} characters`),
  body: z
    .string()
    .trim()
    .max(NOTE_BODY_MAX, `Keep the note under ${NOTE_BODY_MAX} characters`)
    .optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const noteSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

/** `GET /api/notes` response: newest first. */
export const noteListSchema = z.object({
  items: z.array(noteSchema),
});

export const noteIdParamSchema = z.object({
  id: z.uuid(),
});

export type Note = z.infer<typeof noteSchema>;
export type NoteList = z.infer<typeof noteListSchema>;
