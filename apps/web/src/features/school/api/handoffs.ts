import { useQuery } from '@tanstack/react-query';
import type { AgentId } from '@repo/shared';
import { toApiError } from '@/lib/api-error';
import { handoffFeedSchema } from '../handoff-status';

export function useRecipientHandoffs(membershipId: string, agentId: AgentId, roomId: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'handoffs', agentId, roomId],
    queryFn: async ({ signal }) => {
      const search = new URLSearchParams({ classId: roomId });
      const response = await fetch('/api/agents/' + agentId + '/handoffs?' + search, { signal });
      if (!response.ok) throw await toApiError(response, 'อ่านงานที่ได้รับจากน้องแจ๋วไม่สำเร็จ');
      return handoffFeedSchema.parse(await response.json()).handoffs;
    },
    refetchInterval: ({ state }) => (state.error ? 15_000 : 4000),
    retry: false,
  });
}
