import { lessonVideoNow } from './limits';
import type { Story } from './story';

const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const drafts = new Map<string, { ownerId: string; story: Story; expiresAt: number }>();

export function storeDraft(ownerId: string, story: Story) {
  const now = lessonVideoNow();
  for (const [id, draft] of drafts) {
    if (draft.expiresAt <= now) drafts.delete(id);
  }
  const id = crypto.randomUUID();
  drafts.set(id, { ownerId, story, expiresAt: now + DRAFT_TTL_MS });
  return id;
}

export function findDraft(id: string, ownerId: string) {
  const draft = drafts.get(id);
  if (!draft) return;
  if (draft.expiresAt <= lessonVideoNow()) {
    drafts.delete(id);
    return;
  }
  if (draft.ownerId === ownerId) return draft.story;
}

export function resetDrafts() {
  drafts.clear();
}
