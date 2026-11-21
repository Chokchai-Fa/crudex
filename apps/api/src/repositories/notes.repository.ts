import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { notes, type NoteRow } from '../db/schema';

// The only layer that touches Drizzle. One function per query, plain rows out, no rules.

export type { NoteRow };
export type NewNoteRow = typeof notes.$inferInsert;

export async function insertNote(db: Db, values: NewNoteRow): Promise<NoteRow> {
  const [row] = await db.insert(notes).values(values).returning();
  if (!row) throw new Error('Insert returned no row');
  return row;
}

export async function listRecentNotes(db: Db, limit: number): Promise<NoteRow[]> {
  return db.select().from(notes).orderBy(desc(notes.createdAt), desc(notes.id)).limit(limit);
}

/** Returns true when a row was deleted. */
export async function deleteNoteById(db: Db, id: string): Promise<boolean> {
  const deleted = await db.delete(notes).where(eq(notes.id, id)).returning({ id: notes.id });
  return deleted.length > 0;
}
