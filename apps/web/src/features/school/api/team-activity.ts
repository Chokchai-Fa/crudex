import { queryOptions, useQueries, useQueryClient } from '@tanstack/react-query';
import type { AgentId, RunEvent, RunStatus } from '@repo/shared';
import { liveRunQuery, runEventsQuery } from './run-events';
import { schoolRunsQuery } from './school';

export const teamActivityLabels = {
  queued: 'รอคิว',
  running: 'กำลังทำงาน',
  coordinating: 'กำลังประสานงาน',
  assisting: 'กำลังช่วยงาน',
} as const;
export type TeamActivity = keyof typeof teamActivityLabels;

function active(status: RunStatus) {
  return status === 'queued' || status === 'running';
}

export function useTeamActivity(
  membershipId: string,
  roomId: string,
  selectedAgent: AgentId,
  agents: ReadonlyArray<{ id: AgentId }>,
) {
  const client = useQueryClient();
  const histories = useQueries({
    queries: agents.map(({ id }) =>
      queryOptions({
        ...schoolRunsQuery(membershipId, id),
        // The open chat already refreshes its history. Subscribe to the same cache.
        enabled: id !== selectedAgent,
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        refetchInterval: ({ state }) => {
          const busy = state.data?.runs.some(
            (run) => run.agentId === id && run.classId === roomId && active(run.status),
          );
          if (!busy) return false;
          return state.error ? 10_000 : 2500;
        },
      }),
    ),
  });
  // An assistant's worksheet history may also contain work owned by another assistant.
  const parents = histories.flatMap((history, index) =>
    history.isError
      ? []
      : (history.data?.runs ?? []).filter(
          (run) =>
            run.classId === roomId && run.agentId === agents[index]?.id && active(run.status),
        ),
  );
  const openHistory = histories[agents.findIndex((a) => a.id === selectedAgent)]?.data;
  const openIds = new Set(openHistory?.runs.filter((r) => r.classId === roomId).map((r) => r.id));
  const live = useQueries({ queries: parents.map((run) => liveRunQuery(membershipId, run.id)) });
  const streams = useQueries({
    queries: parents.map((run, index) => ({
      ...runEventsQuery(client, membershipId, run.id, true),
      enabled: !live[index]?.data && !openIds.has(run.id),
    })),
  });

  const activity = new Map<AgentId, TeamActivity>();
  // Overlapping runs share one row: keep the most informative current state.
  const priority = { queued: 0, running: 1, assisting: 2, coordinating: 3 };
  function mark(id: AgentId, next: TeamActivity) {
    const previous = activity.get(id);
    if (!previous || priority[next] > priority[previous]) activity.set(id, next);
  }
  for (const [i, run] of parents.entries()) {
    const stream = streams[i];
    const direct = live[i]?.data;
    if (direct ? direct.complete : stream?.data?.nextPoll === false) continue;
    const events = direct?.events ?? (stream?.isError ? [] : (stream?.data?.events ?? []));
    const state = activeRun(run.status, events);
    if (!state) continue;
    for (const child of state.children) mark(child, 'assisting');
    mark(run.agentId, state.children.size ? 'coordinating' : state.phase);
  }
  return activity;
}

function activeRun(status: RunStatus, events: readonly RunEvent[]) {
  let phase: 'queued' | 'running' = status === 'running' ? 'running' : 'queued';
  const children = new Map<string, AgentId>();
  for (const event of events) {
    if (
      event.type === 'done' ||
      event.type === 'error' ||
      (event.type === 'status' && !active(event.status))
    )
      return;
    if (event.type !== 'status' || event.status === 'running') phase = 'running';
    if (event.type === 'tool' && event.name === 'subagent') {
      if (event.status === 'started' && event.agentId) children.set(event.id, event.agentId);
      else children.delete(event.id);
    }
  }
  return { phase, children: new Set(children.values()) };
}
