import { createFileRoute } from '@tanstack/react-router';
import { SchoolChat } from '@/features/school/chat';
export const Route = createFileRoute('/teacher')({
  validateSearch: (search): { roomId?: string } => ({
    roomId: typeof search.roomId === 'string' ? search.roomId : undefined,
  }),
  component: Teacher,
});
function Teacher() {
  const { roomId } = Route.useSearch();
  return <SchoolChat initialRoom={roomId} />;
}
