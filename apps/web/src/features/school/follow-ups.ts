/**
 * Agents end a reply with a "ลองถามต่อ:" block of bullet suggestions.
 * Split it off so the bubble shows the reply and the chat shows the suggestions as chips.
 * A missing or malformed block leaves the text untouched and yields no suggestions.
 */
const header = /^\s*\**\s*ลองถามต่อ\s*[:：]?\s*\**\s*$/u;
const bullet = /^\s*[-•*]\s+(.+?)\s*$/u;

export function parseFollowUps(text: string): { body: string; items: string[] } {
  const lines = text.split(/\r?\n/);
  let i = lines.length - 1;
  const items: string[] = [];
  while (i >= 0) {
    const line = lines[i]!;
    if (!line.trim()) {
      i--;
      continue;
    }
    const match = bullet.exec(line);
    if (!match) break;
    items.unshift(match[1]!.replace(/\s+/g, ' '));
    i--;
  }
  if (i < 0 || !items.length || !header.test(lines[i]!)) return { body: text, items: [] };
  return { body: lines.slice(0, i).join('\n').trimEnd(), items: items.slice(0, 3) };
}
