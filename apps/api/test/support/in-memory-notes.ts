// In-memory stand-in for `repositories/notes.repository.ts`. Tests swap it in with vi.mock, so
// services and routes run without Neon. Same function names and shapes as the real module.
import type { NewNoteRow, NoteRow } from '../../src/repositories/notes.repository';

let rows: NoteRow[] = [];
let tick = 0;

export function resetNotes() {
  rows = [];
  tick = 0;
}

// Each insert is one second later than the last, so ordering is deterministic.
export async function insertNote(_db: unknown, values: NewNoteRow): Promise<NoteRow> {
  tick += 1;
  const row: NoteRow = {
    id: crypto.randomUUID(),
    title: values.title,
    body: values.body ?? null,
    createdAt: new Date(Date.UTC(2026, 0, 1) + tick * 1000),
  };
  rows.push(row);
  return row;
}

export async function listRecentNotes(_db: unknown, limit: number): Promise<NoteRow[]> {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
}

export async function deleteNoteById(_db: unknown, id: string): Promise<boolean> {
  const before = rows.length;
  rows = rows.filter((row) => row.id !== id);
  return rows.length < before;
}
