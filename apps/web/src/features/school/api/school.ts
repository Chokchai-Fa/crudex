import { meSchema, type AgentId, type CreateRun, type GuestSignIn } from '@repo/shared';
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { startDirectChat } from './direct-chat';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';

const sessionKey = ['school-session'] as const;
const jaew = api.agents[':id'];

export function useSchoolSession() {
  return useQuery({
    queryKey: sessionKey,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const health = await api.health.$get();
      if (
        !health.ok ||
        (await health.json()).env !==
          (import.meta.env.MODE === 'school-local' ? 'development' : 'production')
      ) {
        throw new Error('ยังไม่ได้เชื่อมต่อ School API ของโรงเรียน');
      }
      const res = await api.me.$get();
      if (res.status === 401) return null;
      if (!res.ok) throw await toApiError(res, 'เปิดบัญชีโรงเรียนไม่สำเร็จ');
      return meSchema.parse(await res.json());
    },
  });
}

export function useSchoolLogin() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: { credential: string } | GuestSignIn) => {
      const res =
        'role' in input
          ? await api.auth.guest.$post({ json: input })
          : await api.auth.session.$post({ json: input });
      if (!res.ok) throw await toApiError(res, 'เข้าใช้โรงเรียนไม่สำเร็จ');
      return meSchema.parse(await res.json());
    },
    onSuccess: (me) => {
      client.removeQueries({ queryKey: ['school-data'] });
      client.setQueryData(sessionKey, me);
    },
  });
}

export function useSchoolLogout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.auth.session.$delete();
      if (!res.ok) throw await toApiError(res, 'ออกจากระบบไม่สำเร็จ');
    },
    onSuccess: () => {
      client.setQueryData(sessionKey, null);
      client.removeQueries({ queryKey: ['school-data'] });
    },
  });
}

export function useSchoolGradebook(membershipId: string, id: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'grades', id],
    staleTime: 0,
    queryFn: async () => {
      const res = await api.classes[':id'].gradebook.$get({ param: { id } });
      if (!res.ok) throw await toApiError(res, 'อ่านสมุดคะแนนไม่สำเร็จ');
      return res.json();
    },
  });
}

export function useSchoolBrief(membershipId: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'brief'],
    staleTime: 0,
    queryFn: async () => {
      const res = await api.briefs.morning.$get({ query: {} });
      if (!res.ok) throw await toApiError(res, 'อ่านสรุปโรงเรียนไม่สำเร็จ');
      return res.json();
    },
  });
}

export function schoolRunsQuery(membershipId: string, agentId: AgentId) {
  return queryOptions({
    queryKey: ['school-data', membershipId, 'runs', agentId],
    staleTime: 0,
    queryFn: async ({ signal }) => {
      const res = await jaew.history.$get({ param: { id: agentId } }, { init: { signal } });
      if (!res.ok) throw await toApiError(res, 'อ่านประวัติงานไม่สำเร็จ');
      return res.json();
    },
  });
}

export function useSchoolRuns(membershipId: string, agentId: AgentId = 'jaew') {
  return useQuery({
    ...schoolRunsQuery(membershipId, agentId),
    refetchOnWindowFocus: true,
    refetchInterval: ({ state }) =>
      state.data?.runs.some((r) => r.status === 'queued' || r.status === 'running') ? 1500 : false,
  });
}

export function useCreateSchoolRun(membershipId: string, agentId: AgentId = 'jaew') {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ background, ...input }: CreateRun & { background: boolean }) => {
      if (!background) return startDirectChat(client, membershipId, agentId, input);
      const res = await jaew.runs.$post({ param: { id: agentId }, json: input });
      if (!res.ok) throw await toApiError(res, 'ส่งคำขอไม่สำเร็จ');
      return res.json();
    },
    onSuccess: async (run, input) => {
      const { queryKey } = schoolRunsQuery(membershipId, agentId);
      // A foreground stream acknowledges with just X-Run-Id. History replaces this local
      // receipt with the server's timestamp and state; durable retries return the full row.
      const receipt = {
        agentId,
        clientRequestId: input.clientRequestId,
        classId: input.classId ?? null,
        prompt: input.prompt,
        status: 'queued' as const,
        createdAt: new Date().toISOString(),
        ...run,
        worksheetIds: [],
      };
      await client.cancelQueries({ queryKey, exact: true });
      client.setQueryData(queryKey, (previous) => {
        if (previous?.runs.some((r) => r.id === run.id)) return previous;
        return {
          runs: [receipt, ...(previous?.runs ?? [])],
        };
      });
      void client.invalidateQueries({ queryKey, exact: true });
    },
  });
}

export async function readSchoolWorksheet(id: string) {
  const res = await api.assessments[':id'].$get({ param: { id } });
  if (!res.ok) throw await toApiError(res, 'เปิดใบงานไม่สำเร็จ');
  return res.json();
}

export function useSchoolWorksheet(membershipId: string, id: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'worksheet', id],
    queryFn: () => readSchoolWorksheet(id),
  });
}

export function useSchoolQuiz(membershipId: string, id: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'quiz', id],
    queryFn: async () => {
      const res = await api.play[':id'].$get({ param: { id } });
      if (!res.ok) throw await toApiError(res, 'เปิดฟอร์มไม่สำเร็จ');
      return res.json();
    },
  });
}

export function useSubmitSchoolQuiz(id: string) {
  return useMutation({
    mutationFn: async (answers: Record<string, string>) => {
      const res = await api.play[':id'].$post({ param: { id }, json: { answers } });
      if (!res.ok) throw await toApiError(res, 'ส่งคำตอบไม่สำเร็จ');
      return res.json();
    },
  });
}

export function useSchoolAgents(membershipId: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'agents'],
    queryFn: async () => {
      const response = await api.agents.$get();
      if (!response.ok) throw await toApiError(response, 'อ่านรายชื่อผู้ช่วยไม่สำเร็จ');
      return response.json();
    },
  });
}

export function useSchoolRoutines(membershipId: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'routines'],
    queryFn: async () => {
      const response = await api.routines.$get();
      if (!response.ok) throw await toApiError(response, 'อ่านนัดหมายไม่สำเร็จ');
      return response.json();
    },
  });
}

export function useSchoolMemories(membershipId: string) {
  return useQuery({
    queryKey: ['school-data', membershipId, 'memories'],
    queryFn: async () => {
      const response = await api.memories.$get();
      if (!response.ok) throw await toApiError(response, 'อ่านความจำไม่สำเร็จ');
      return response.json();
    },
  });
}
