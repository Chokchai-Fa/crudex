import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

const runMemory = api.runs[':id'].memory;

export function useRunMemory(membershipId: string, id: string, lastProposalId: string) {
  const client = useQueryClient();
  const key = ['school-data', membershipId, 'run-memory', id];
  const proposals = useQuery({
    queryKey: [...key, lastProposalId],
    queryFn: async ({ signal }) => {
      const response = await runMemory.$get({ param: { id } }, { init: { signal } });
      if (!response.ok) throw new Error('เปิดข้อเสนอความจำไม่สำเร็จ');
      return response.json();
    },
  });
  const approve = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await runMemory[':proposalId'].approve.$post({ param: { id, proposalId } });
      if (!response.ok) throw new Error('ยืนยันการจดจำไม่สำเร็จ');
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: key }),
        client.invalidateQueries({ queryKey: ['school-data', membershipId, 'memories'] }),
      ]),
  });
  return { proposals, approve };
}
