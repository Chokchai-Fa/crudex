import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';
import { noteKeys } from './use-notes';

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.notes[':id'].$delete({ param: { id } });
      if (!res.ok) throw await toApiError(res, "Couldn't delete this note. Try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: noteKeys.list }),
  });
}
