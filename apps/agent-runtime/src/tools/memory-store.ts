import { memoryIssue } from '../../../../packages/shared/src/memory.schema';
import { memory, normalizeMemory, persistState, type MemoryItem } from '../state';
import { ToolError } from './identity';

export type { MemoryItem } from '../state';

export function saveMemory(ownerId: string, rawText: string, now = Date.now()) {
  const text = rawText.replace(/\s+/g, ' ').trim();
  const issue = memoryIssue(text);
  if (issue) throw new ToolError(issue.code, issue.message);
  const items = memory.get(ownerId) ?? new Map<string, MemoryItem>();
  memory.set(ownerId, items);
  const key = normalizeMemory(text);
  const existing = items.get(key);
  if (existing) {
    existing.updatedAt = now;
    persistState();
    return { id: existing.id, duplicate: true };
  }
  const id = crypto.randomUUID();
  items.set(key, { id, text, updatedAt: now });
  persistState();
  return { id, duplicate: false };
}

export function searchMemory(ownerId: string, query: string, limit = 5): MemoryItem[] {
  const terms = normalizeMemory(query).split(' ').filter(Boolean);
  return [...(memory.get(ownerId)?.values() ?? [])]
    .filter((item) => terms.every((term) => normalizeMemory(item.text).includes(term)))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export function resetMemory() {
  memory.clear();
  persistState();
}
