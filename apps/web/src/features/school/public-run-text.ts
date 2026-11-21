import type { RunEvent } from '@repo/shared';

/**
 * Every message the agent writes stays on screen, in order. Interim markers only flag a message
 * that continued with a tool; hiding it made streamed text vanish when the next message began.
 */
export function publicRunText(events: readonly RunEvent[]): string {
  let text = '';
  let current: string | undefined;
  for (const event of events) {
    if (event.type !== 'delta' || !event.text) continue;
    let chunk = event.text;
    if (text && event.messageId !== current) {
      const boundary = text.slice(-2) + chunk.slice(0, 2);
      if (!boundary.includes('\n\n'))
        chunk = (text.endsWith('\n') || chunk.startsWith('\n') ? '\n' : '\n\n') + chunk;
    }
    current = event.messageId;
    text += chunk;
  }
  return text;
}
