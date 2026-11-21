import type { RunEvent } from '@repo/shared';

export function publicRunText(events: readonly RunEvent[], final: boolean): string {
  const deltas = events.filter((event) => event.type === 'delta');
  // A later marker can reclassify all earlier chunks of the same root message.
  const interimIds = new Set<string>();
  for (const delta of deltas) {
    if (delta.interim && delta.messageId) interimIds.add(delta.messageId);
  }
  return deltas
    .filter(({ messageId, interim }) => {
      if (interim || (messageId && interimIds.has(messageId))) return false;
      if (!messageId || final) return true;
      // The runtime publishes artifacts and completed delegated replies with these IDs.
      return messageId.startsWith('worksheet:') || messageId.startsWith('reply:');
    })
    .map((delta) => delta.text)
    .join('');
}
