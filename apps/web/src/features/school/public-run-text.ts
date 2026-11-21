import type { RunEvent } from '@repo/shared';

export function publicRunText(events: readonly RunEvent[]): string {
  const deltas = events.filter((event) => event.type === 'delta');
  // A later marker can reclassify all earlier chunks of the same root message.
  const interimIds = new Set<string>();
  for (const delta of deltas) {
    if (delta.interim && delta.messageId) interimIds.add(delta.messageId);
  }
  return deltas
    .filter(({ messageId, interim }) => !interim && !(messageId && interimIds.has(messageId)))
    .map((delta) => delta.text)
    .join('');
}
