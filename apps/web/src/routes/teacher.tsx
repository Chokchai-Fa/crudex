import { agentIdSchema, type AgentId } from '@repo/shared';
import { z } from 'zod';
import { createFileRoute } from '@tanstack/react-router';
import { SchoolChat } from '@/features/school/chat';
export const Route = createFileRoute('/teacher')({
  validateSearch: (search): { roomId?: string; agentId?: AgentId; handoff?: string } => {
    const agent = agentIdSchema.safeParse(search.agentId);
    const agentId =
      agent.success && agent.data !== 'rungchao' && agent.data !== 'lekha_por'
        ? agent.data
        : undefined;
    return {
      roomId: typeof search.roomId === 'string' ? search.roomId : undefined,
      agentId,
      handoff: agentId === 'jeng' ? z.uuid().safeParse(search.handoff).data : undefined,
    };
  },
  component: Teacher,
});
function Teacher() {
  const { roomId, agentId, handoff } = Route.useSearch();
  return <SchoolChat initialRoom={roomId} agent={agentId} handoff={handoff} />;
}
