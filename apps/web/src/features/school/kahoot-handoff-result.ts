import type { RunEvent } from '@repo/shared';
import { publicRunText } from './public-run-text';

const editorUrl = /https:\/\/create\.kahoot\.it\/[^\s<>()[\]`"']+/g;

export function kahootHandoff(events: readonly RunEvent[], prompt = '') {
  const answer = publicRunText(events);
  const delegate = events.findLast(
    (event) => event.type === 'tool' && event.name === 'subagent' && event.agentId === 'jeng',
  );
  const kahootTool = events.findLast(
    (event) => event.type === 'tool' && event.name === 'crudex_kahoot_create_or_update_kahoot',
  );
  const matches = answer.match(editorUrl) ?? [];
  const links = [...new Set(matches.map((url) => url.replace(/[.,!?;:]+$/, '')))];
  if (
    delegate?.type !== 'tool' ||
    (!kahootTool && !links.length && !/kahoot|คาฮู[ทตด]/iu.test(prompt + '\n' + answer))
  )
    return;
  const onlyJeng = !events.some(
    (event) =>
      event.type === 'tool' &&
      event.name === 'subagent' &&
      event.agentId &&
      event.agentId !== 'jeng',
  );
  // Older runtimes appended the worker's reply as a separate, prefixed delta.
  const detailIds = new Set(
    onlyJeng
      ? events.flatMap((event) =>
          event.type === 'delta' && event.messageId?.startsWith('reply:') ? [event.messageId] : [],
        )
      : [],
  );
  const detailEvents = events.filter(
    (event) => event.type === 'delta' && event.messageId && detailIds.has(event.messageId),
  );
  const details = publicRunText(detailEvents).trim();
  return { status: delegate.status, links, details, detailIds };
}

export function kahootOwnerSummary(answer: string) {
  return answer
    .replace(/\[[^\]\n]+\]\(https:\/\/create\.kahoot\.it\/[^\s<>()]+\)/g, '')
    .replace(editorUrl, '')
    .replace(/(?:\bUUID\s*[:=]?\s*)?\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, '')
    .split('\n')
    .filter((line) => !/^\s*[-*]\s*$/.test(line))
    .join('\n')
    .trim();
}
