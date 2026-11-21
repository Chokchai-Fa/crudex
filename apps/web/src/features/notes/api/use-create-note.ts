import { noteSchema, type CreateNoteInput } from '@repo/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';
import { noteKeys } from './use-notes';

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateNoteInput) => {
      const res = await api.notes.$post({ json: input });
      if (!res.ok) {
        throw await toApiError(
          res,
          "Couldn't save this note. Your text is still here — try again.",
        );
      }
      return noteSchema.parse(await res.json());
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.list }),
  });
}
