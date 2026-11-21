import { useQuery, useQueryClient } from '@tanstack/react-query';
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

export function useRunEvents(membershipId: string, id: string, active: boolean) {
  const client = useQueryClient();
  const queryKey = ['school-data', membershipId, 'events', id] as const;
  const live = useQuery<LiveChat | null>({
    queryKey: liveChatKey(membershipId, id),
    enabled: false,
    queryFn: () => null,
  });
  const query = useQuery({
    enabled: !live.data,
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
  return {
    events: live.data?.events ?? query.data?.events ?? [],
    error: query.error?.message ?? '',
    loading: !live.data && !active && query.isPending,
    complete: live.data?.complete ?? query.data?.nextPoll === false,
  };
}
