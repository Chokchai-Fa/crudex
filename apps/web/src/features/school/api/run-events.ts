import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  runEventBatchMediaType,
  runEventBatchSchema,
  runEventPageSize,
  type RunEvent,
} from '@repo/shared';
import { liveChatKey, type LiveChat } from './direct-chat';
import { api } from '@/lib/api-client';
import { ApiError, toApiError } from '@/lib/api-error';

interface Replay {
  events: RunEvent[];
  cursor: number;
  nextPoll: number | false;
}

export function runEventsQuery(
  client: QueryClient,
  membershipId: string,
  id: string,
  active: boolean,
) {
  const queryKey = ['school-data', membershipId, 'events', id] as const;
  return queryOptions({
    queryKey,
    staleTime: Infinity,
    queryFn: async ({ signal }): Promise<Replay> => {
      const previous = client.getQueryData<Replay>(queryKey) ?? {
        events: [],
        cursor: 0,
        nextPoll: 2500,
      };
      const response = await api.runs[':id'].events.$get(
        { param: { id } },
        {
          headers: { Accept: runEventBatchMediaType, 'Last-Event-ID': String(previous.cursor) },
          init: { signal },
        },
      );
      if (!response.ok) throw await toApiError(response, 'อ่านเหตุการณ์ของงานไม่สำเร็จ');
      if (response.status === 204) return { ...previous, nextPoll: false };
      const batch = runEventBatchSchema.parse(await response.json());
      let cursor = previous.cursor;
      for (const event of batch) {
        const next = Number(event.id);
        if (
          !Number.isSafeInteger(next) ||
          next <= cursor ||
          event.source !== '/api/runs/' + id ||
          event.type !== 'work.crudex.run.' + event.data.type
        )
          throw new Error('อ่านลำดับเหตุการณ์ของงานไม่สำเร็จ');
        cursor = next;
      }
      return {
        events: batch.length ? previous.events.concat(batch.map((e) => e.data)) : previous.events,
        cursor,
        nextPoll: batch.length === runEventPageSize || (!active && batch.length > 0) ? 100 : 2500,
      };
    },
    retry: (attempt, error) => !(error instanceof ApiError && error.status < 500) && attempt < 2,
    refetchInterval: ({ state }) => {
      if (
        state.error instanceof TypeError ||
        (state.error instanceof ApiError && state.error.status >= 500)
      )
        return 5000;
      return state.error ? false : (state.data?.nextPoll ?? false);
    },
    refetchOnReconnect: ({ state }) => (state.data?.nextPoll !== false ? 'always' : false),
  });
}

// Direct chat publishes NDJSON batches into this cache. Losing the stream clears the value
// and the existing run resumes from durable history without sending a second prompt.
export function liveRunQuery(membershipId: string, id: string) {
  return queryOptions({
    queryKey: liveChatKey(membershipId, id),
    queryFn: (): LiveChat | null => null,
    enabled: false,
  });
}

function useObservedRunEvents(membershipId: string, id: string, active: boolean, fetch: boolean) {
  const client = useQueryClient();
  const live = useQuery(liveRunQuery(membershipId, id));
  const query = useQuery({
    ...runEventsQuery(client, membershipId, id, active),
    enabled: fetch && !live.data,
  });
  return {
    events: live.data?.events ?? query.data?.events ?? [],
    error: live.data ? '' : (query.error?.message ?? ''),
    loading: !live.data && !active && query.isPending,
    reload: query.refetch,
    complete: live.data?.complete ?? query.data?.nextPoll === false,
  };
}

export function useRunEvents(membershipId: string, id: string, active: boolean) {
  return useObservedRunEvents(membershipId, id, active, true);
}

// The side panel follows both transports without making a second read.
export function useCachedRunEvents(membershipId: string, id: string) {
  return useObservedRunEvents(membershipId, id, false, false);
}
