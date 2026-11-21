import { Link } from '@tanstack/react-router';
import type { AgentId } from '@repo/shared';
import { useCachedRunEvents } from './api/run-events';
import { useRecipientHandoffs } from './api/handoffs';
import { handoffStatusText, runHandoffs } from './handoff-status';
import type { AgentNames } from './run-presentation';
import { teacherMessage } from './worksheet-context';

export function RunHandoffs({
  id,
  membershipId,
  agents,
}: {
  id: string;
  membershipId: string;
  agents: AgentNames;
}) {
  const { events } = useCachedRunEvents(membershipId, id);
  const handoffs = runHandoffs(events);
  if (!handoffs.length) return null;
  return (
    <ul className="space-y-1 text-sm text-muted-foreground" aria-live="polite">
      {handoffs.map(({ handoffId, agentId, status }) => {
        const name = agents.find((agent) => agent.id === agentId)?.name;
        if (!name) return null;
        return (
          <li key={handoffId}>
            {name}รับงานจากน้องแจ๋ว · {handoffStatusText[status]}
          </li>
        );
      })}
    </ul>
  );
}

export function RecipientHandoffs({
  membershipId,
  agentId,
  agentName,
  roomId,
}: {
  membershipId: string;
  agentId: AgentId;
  agentName: string;
  roomId: string;
}) {
  const { data, error } = useRecipientHandoffs(membershipId, agentId, roomId);
  const handoffs = data?.filter((handoff) => handoff.agentId === agentId) ?? [];
  if (error && !data)
    return (
      <p className="my-3 text-sm text-muted-foreground" role="status">
        อ่านงานที่ได้รับจากน้องแจ๋วไม่สำเร็จ
      </p>
    );
  if (!handoffs.length) return null;

  return (
    <details className="my-3 rounded-xl border bg-card p-3 text-sm" open>
      <summary className="cursor-pointer font-semibold">งานที่ได้รับจากน้องแจ๋ว</summary>
      <ul className="mt-2 space-y-2" aria-live="polite">
        {handoffs.map(({ parentRunId, handoffId, status, prompt }) => (
          <li key={parentRunId + '/' + handoffId} className="space-y-1">
            <p>
              {agentName}รับงานจากน้องแจ๋ว · {handoffStatusText[status]}
            </p>
            <p className="whitespace-pre-wrap break-words text-muted-foreground">
              {teacherMessage(prompt)}
            </p>
          </li>
        ))}
      </ul>
      <Link
        to="/teacher"
        search={{ roomId, agentId: 'jaew' }}
        className="mt-2 inline-flex py-2 text-primary underline underline-offset-2"
      >
        เปิดแชตน้องแจ๋ว
      </Link>
    </details>
  );
}
