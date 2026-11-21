import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetNotes } from './support/in-memory-notes';

// Full app through the Worker entry, with the repository swapped for an in-memory one.
vi.mock('../src/repositories/notes.repository', () => import('./support/in-memory-notes'));

const BASE = 'http://example.com/api/notes';

function postNote(body: unknown) {
  return exports.default.fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => resetNotes());

describe('POST /api/notes', () => {
  it('returns 201 with the created note', async () => {
    const res = await postNote({ title: 'Hello', body: 'World' });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ title: 'Hello', body: 'World' });
  });

  it('rejects an empty title with a readable message', async () => {
    const res = await postNote({ title: '   ' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: 'validation_error', message: 'Give it a title' },
    });
  });
});

describe('GET /api/notes', () => {
  it('lists notes newest first', async () => {
    await postNote({ title: 'first' });
    await postNote({ title: 'second' });

    const res = await exports.default.fetch(BASE);
    const body = await res.json<{ items: { title: string }[] }>();
    expect(body.items.map((note) => note.title)).toEqual(['second', 'first']);
  });
});

describe('DELETE /api/notes/:id', () => {
  it('returns 204, then 404 once it is gone, and 400 for a malformed id', async () => {
    const created = await (await postNote({ title: 'bye' })).json<{ id: string }>();

    const deleted = await exports.default.fetch(`${BASE}/${created.id}`, { method: 'DELETE' });
    expect(deleted.status).toBe(204);

    const again = await exports.default.fetch(`${BASE}/${created.id}`, { method: 'DELETE' });
    expect(again.status).toBe(404);
    expect((await again.json<{ error: { code: string } }>()).error.code).toBe('not_found');

    const malformed = await exports.default.fetch(`${BASE}/not-a-uuid`, { method: 'DELETE' });
    expect(malformed.status).toBe(400);
  });
});
