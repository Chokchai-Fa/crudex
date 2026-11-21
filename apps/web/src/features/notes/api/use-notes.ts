import { noteListSchema } from '@repo/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';

export const noteKeys = {
  list: ['notes', 'list'] as const,
};

export function useNotes() {
  return useQuery({
    queryKey: noteKeys.list,
    queryFn: async () => {
      const res = await api.notes.$get();
      if (!res.ok) {
        throw await toApiError(res, "Couldn't load notes. Check your connection and try again.");
      }
      return noteListSchema.parse(await res.json());
    },
  });
}
