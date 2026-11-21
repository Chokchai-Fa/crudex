import type { RunEvent } from '@repo/shared';

export function kahootHandoff(events: readonly RunEvent[], answer: string) {
  const delegate = events.findLast(
    (event) => event.type === 'tool' && event.name === 'subagent' && event.agentId === 'jeng',
  );
  const kahootTool = events.findLast(
    (event) => event.type === 'tool' && event.name === 'crudex_kahoot_create_or_update_kahoot',
  );
  const matches = answer.match(/https:\/\/create\.kahoot\.it\/[^\s<>()[\]`"']+/g) ?? [];
  const links = [...new Set(matches.map((url) => url.replace(/[.,!?;:]+$/, '')))];
  if (delegate?.type !== 'tool' || (!kahootTool && !links.length && !/kahoot/i.test(answer)))
    return;
  return { status: delegate.status, links };
}
