import { agentIdSchema, type RunEvent } from '@repo/shared';
import { z } from 'zod';

export const handoffStatusSchema = z.enum(['started', 'success', 'failed', 'returned']);
export const handoffFeedSchema = z.object({
  handoffs: z.array(
    z.object({
      parentRunId: z.uuid(),
      handoffId: z.string().min(1),
      agentId: agentIdSchema,
      status: handoffStatusSchema,
      prompt: z.string(),
      createdAt: z.string(),
    }),
  ),
});

export function runHandoffs(events: readonly RunEvent[]) {
  const handoffs = new Map<
    string,
    { agentId: z.infer<typeof agentIdSchema>; status: z.infer<typeof handoffStatusSchema> }
  >();
  for (const event of events) {
    if (event.type !== 'tool') continue;
    const returned = event.name === 'subagent_return' && event.status === 'success';
    if (event.name !== 'subagent' && !returned) continue;

    const previous = handoffs.get(event.id);
    if (returned && !previous) continue;
    const agentId = previous?.agentId ?? event.agentId;
    if (!agentId || (event.agentId && event.agentId !== agentId)) continue;
    if (previous?.status === 'returned' || (previous && event.status === 'started')) continue;
    handoffs.set(event.id, { agentId, status: returned ? 'returned' : event.status });
  }
  return [...handoffs].map(([handoffId, handoff]) => ({ handoffId, ...handoff }));
}

export const handoffStatusText: Record<z.infer<typeof handoffStatusSchema>, string> = {
  started: 'กำลังทำงาน',
  success: 'ทำงานเสร็จแล้ว',
  failed: 'ทำงานไม่สำเร็จ',
  returned: 'ส่งผลกลับถึงน้องแจ๋วแล้ว',
};
