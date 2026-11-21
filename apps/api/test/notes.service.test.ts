import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../src/lib/errors';
import { createNote, deleteNote, listNotes } from '../src/services/notes.service';
import { makeFakeDeps } from './support/fake-deps';
import { resetNotes } from './support/in-memory-notes';

// Services are unit-tested with fake deps and an in-memory repository — no DB, no mocking framework.
vi.mock('../src/repositories/notes.repository', () => import('./support/in-memory-notes'));

beforeEach(() => resetNotes());

describe('createNote', () => {
  it('saves the note and queues a note-created job', async () => {
    const { deps, enqueued } = makeFakeDeps();
    const note = await createNote(deps, { title: 'Hello', body: '' });

    expect(note).toMatchObject({ title: 'Hello', body: null });
    expect(enqueued).toEqual([{ type: 'note-created', noteId: note.id }]);
  });

  it('still saves the note when the queue is unavailable', async () => {
    const { deps } = makeFakeDeps({ failEnqueue: true });
    await createNote(deps, { title: 'Hello' });
    expect((await listNotes(deps)).items).toHaveLength(1);
  });
});

describe('listNotes', () => {
  it('returns newest first', async () => {
    const { deps } = makeFakeDeps();
    for (const title of ['a', 'b', 'c']) await createNote(deps, { title });
    expect((await listNotes(deps)).items.map((note) => note.title)).toEqual(['c', 'b', 'a']);
  });
});

describe('deleteNote', () => {
  it('throws NotFoundError for an unknown id', async () => {
    const { deps } = makeFakeDeps();
    await expect(deleteNote(deps, crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
  });
});
