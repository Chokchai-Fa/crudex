import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Example table — replace with your own (and regenerate migrations with `db:generate`). */
export const notes = pgTable(
  'notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    body: text('body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notes_created_at_idx').on(table.createdAt.desc())],
);

export type NoteRow = typeof notes.$inferSelect;
