import type { CreateNoteInput, Note, NoteList } from '@repo/shared';
import { NotFoundError } from '../lib/errors';
import {
  deleteNoteById,
  insertNote,
  listRecentNotes,
  type NoteRow,
} from '../repositories/notes.repository';
import type { Deps } from '../types/deps';

// Business logic as plain functions: no Hono, no HTTP statuses — throw AppError subclasses.

export const NOTES_LIST_LIMIT = 50;

/** Responses are built field by field so internal columns never leak by accident. */
function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Saves a note, then queues a background job for it (example of async work). */
export async function createNote(deps: Deps, input: CreateNoteInput): Promise<Note> {
  const row = await insertNote(deps.db, { title: input.title, body: input.body || null });
  try {
    await deps.queue.enqueue({ type: 'note-created', noteId: row.id });
  } catch (error) {
    // The note is saved either way; background work is best-effort in this example.
    console.error('Could not queue note-created job', {
      noteId: row.id,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return toNote(row);
}

export async function listNotes(deps: Deps): Promise<NoteList> {
  const rows = await listRecentNotes(deps.db, NOTES_LIST_LIMIT);
  return { items: rows.map(toNote) };
}

export async function deleteNote(deps: Deps, id: string): Promise<void> {
  const deleted = await deleteNoteById(deps.db, id);
  if (!deleted) throw new NotFoundError('Note not found');
}

/** Queue job for a new note. Must be idempotent: messages can be delivered more than once. */
export async function handleNoteCreated(_deps: Deps, noteId: string): Promise<void> {
  console.log('note-created job', { noteId });
}
