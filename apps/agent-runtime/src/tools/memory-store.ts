import { ToolError } from './identity';

export interface MemoryItem {
  id: string;
  text: string;
  updatedAt: number;
}

import { memoryIssue } from '../../../../packages/shared/src/memory.schema';
const normalize = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();

/** In-process store keyed by owner. The sandbox restarts with a fresh database, so this is a stand-in for SQLite FTS5. */
const store = new Map<string, Map<string, MemoryItem>>();

export function saveMemory(ownerId: string, rawText: string, now = Date.now()) {
  const text = rawText.replace(/\s+/g, ' ').trim();
  const issue = memoryIssue(text);
  if (issue) throw new ToolError(issue.code, issue.message);
  const items = store.get(ownerId) ?? new Map<string, MemoryItem>();
  store.set(ownerId, items);
  const key = normalize(text);
  const existing = items.get(key);
  if (existing) {
    existing.updatedAt = now;
    return { id: existing.id, duplicate: true };
  }
  const id = crypto.randomUUID();
  items.set(key, { id, text, updatedAt: now });
  return { id, duplicate: false };
}

export function searchMemory(ownerId: string, query: string, limit = 5): MemoryItem[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  return [...(store.get(ownerId)?.values() ?? [])]
    .filter((item) => terms.every((term) => normalize(item.text).includes(term)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function resetMemory() {
  store.clear();
}
