import type { InferResponseType } from 'hono/client';
import type { QueryClient } from '@tanstack/react-query';
import { runEventSchema, type AgentId, type CreateRun, type RunEvent } from '@repo/shared';
import { api } from '@/lib/api-client';
import { toApiError } from '@/lib/api-error';

const schoolAgent = api.agents[':id'];
type RunReceipt = InferResponseType<typeof schoolAgent.runs.$post, 202>;

export interface LiveChat {
  events: RunEvent[];
  complete: boolean;
}
export const liveChatKey = (membershipId: string, id: string) =>
  ['school-data', membershipId, 'live-chat', id] as const;

export async function startDirectChat(
  client: QueryClient,
  membershipId: string,
  agent: AgentId,
  input: CreateRun,
): Promise<RunReceipt | Pick<RunReceipt, 'id'>> {
  const response = await schoolAgent.chat.$post({ param: { id: agent }, json: input });
  if (!response.ok) throw await toApiError(response, 'ส่งข้อความไม่สำเร็จ');
  const id = response.headers.get('X-Run-Id');
  if (!id) {
    // An idempotent retry returns the original run as JSON.
    return (await response.json()) as RunReceipt;
  }
  const key = liveChatKey(membershipId, id);
  const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
  client.setQueryData<LiveChat>(key, { events: [], complete: false });
  async function consume() {
    let buffer = '';
    let complete = false;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += chunk.value;
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        const events = lines.filter(Boolean).map((line) => runEventSchema.parse(JSON.parse(line)));
        if (!events.length) continue;
        complete = events.some((e) => e.type === 'done' || e.type === 'error');
        client.setQueryData<LiveChat>(key, (prev) => ({
          events: [...(prev?.events ?? []), ...events],
          complete,
        }));
      }
    } finally {
      reader.releaseLock();
      // A disconnect resumes from durable history; never repeat the model turn.
      if (!complete) client.setQueryData(key, null);
      await client.invalidateQueries({ queryKey: ['school-data', membershipId, 'runs', agent] });
    }
  }
  void consume().catch(() => undefined);
  return { id };
}
