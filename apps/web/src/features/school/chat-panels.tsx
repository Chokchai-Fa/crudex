import { useCachedRunEvents } from './api/run-events';
import { presentRun } from './run-presentation';
import { statusLabels } from './classroom';
import { Link } from '@tanstack/react-router';
import { Clock3, AudioLines } from 'lucide-react';
import type { AgentId, RunStatus, SchoolActor } from '@repo/shared';
import type { CSSProperties } from 'react';
import secretary from '@/assets/mascots/secretary.svg?raw';
import paper from '@/assets/mascots/paper.svg?raw';
import notebook from '@/assets/mascots/notebook.svg?raw';
import envelope from '@/assets/mascots/envelope.svg?raw';
import nun from '@/assets/mascots/nun.svg?raw';
import { BrandLogo } from '@/components/brand-logo';
import {
  useSchoolAgents,
  useSchoolMemories,
  useSchoolRoutines,
  useSchoolLogout,
} from './api/school';
import { teamActivityLabels, useTeamActivity, type TeamActivity } from './api/team-activity';
import './team-activity.css';

const roles: Partial<Record<AgentId, string>> = {
  jaew: 'ประสานงานและจดจำให้ครู',
  jum: 'ใบงาน แบบฝึกหัด และข้อสอบ',
  jeng: 'สื่อการสอน เกม และกิจกรรม',
  porn: 'เอกสารเบิกและงานอนุมัติ',
  nun: 'วิเคราะห์คะแนนนักเรียนและห้องเรียน',
};
const icons = { jaew: 'secretary', jum: 'paper', jeng: 'notebook', porn: 'envelope' } as const;
const mascots = { secretary, paper, notebook, envelope, nun } as const;
/** Inline SVG (not <img>) so CSS can move the pupils on hover; see .mascot in chat-activity.css. */
export function AssistantIcon({ id, size = 40 }: { id: AgentId; size?: number }) {
  const name = id === 'nun' ? 'nun' : (icons[id as keyof typeof icons] ?? 'secretary');
  return (
    <span
      className="mascot"
      data-mascot={name}
      aria-hidden="true"
      style={{ '--mascot-size': size + 'px' } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: mascots[name] }}
    />
  );
}
function TeamRow({
  assistant: { id, name },
  activity,
  selected,
  disabled,
  onAgent,
}: {
  assistant: { id: AgentId; name: string };
  activity?: TeamActivity;
  selected: boolean;
  disabled: boolean;
  onAgent: (id: AgentId) => void;
}) {
  return (
    <button
      disabled={disabled}
      aria-pressed={selected}
      data-activity={activity}
      className={'team-row w-full text-start ' + (selected ? 'current' : '')}
      onClick={() => onAgent(id)}
    >
      <AssistantIcon id={id} />
      <div className="team-row-copy">
        <strong>{name}</strong>
        {activity ? (
          <small className="team-row-activity">
            {activity === 'queued' ? (
              <Clock3 aria-hidden="true" />
            ) : (
              <AudioLines aria-hidden="true" />
            )}
            {teamActivityLabels[activity]}
          </small>
        ) : (
          <small>{roles[id]}</small>
        )}
      </div>
    </button>
  );
}

export function SchoolTeam({
  actor,
  roomId,
  agent,
  onAgent,
  onRoom,
  disabled,
}: {
  actor: SchoolActor;
  roomId: string;
  agent: AgentId;
  onAgent: (id: AgentId) => void;
  onRoom: (id: string) => void;
  disabled: boolean;
}) {
  const directory = useSchoolAgents(actor.membershipId);
  const activity = useTeamActivity(actor.membershipId, roomId, agent, directory.data?.agents ?? []);
  const logout = useSchoolLogout();
  return (
    <nav id="school-team" className="school-team team-nav" aria-label="ห้องและผู้ช่วย">
      <Link to="/school">
        <BrandLogo size={30} />
        <span className="sr-only">Crudex · พื้นที่โรงเรียน</span>
      </Link>
      <fieldset disabled={disabled}>
        <legend>ห้องเรียน</legend>
        <div className="flex flex-wrap gap-1">
          {actor.classes.map((c) => (
            <button
              className="room-pill"
              key={c.id}
              aria-pressed={roomId === c.id}
              onClick={() => onRoom(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        {directory.error && <p role="alert">{directory.error.message}</p>}
        {directory.data?.agents.map((assistant) => (
          <TeamRow
            key={assistant.id}
            assistant={assistant}
            activity={activity.get(assistant.id)}
            selected={agent === assistant.id}
            disabled={disabled}
            onAgent={onAgent}
          />
        ))}
      </div>
      <div className="account-panel">
        <p>ข้อมูลในเดโมนี้เป็นตัวอย่างทั้งหมด</p>
        <strong>บัญชี: {actor.displayName}</strong>
        <Link to="/school">พื้นที่โรงเรียน</Link>
        <button disabled={logout.isPending || disabled} onClick={() => logout.mutate()}>
          ออกจากระบบ
        </button>
        {logout.error && <p role="alert">{logout.error.message}</p>}
      </div>
    </nav>
  );
}
type RoomTask = { id: string; prompt: string; status: RunStatus };

function CurrentTask({ membershipId, task }: { membershipId: string; task: RoomTask }) {
  const replay = useCachedRunEvents(membershipId, task.id);
  const directory = useSchoolAgents(membershipId);
  const events = replay.events;
  const { phase, activity, notice } = presentRun(
    task.status,
    events,
    replay.complete,
    directory.data?.agents,
  );
  const done = events.findLast((event) => event.type === 'done');
  return (
    <>
      <strong>{activity || notice || statusLabels[phase]}</strong>
      <p className="line-clamp-2">{task.prompt}</p>
      {done && phase === 'succeeded' && done.elapsedMs >= 1000 && (
        <small>ใช้เวลา {Math.round(done.elapsedMs / 1000).toLocaleString('th-TH')} วินาที</small>
      )}
    </>
  );
}
export function SchoolActivity({
  agentName,
  actor,
  roomId,
  task,
}: {
  actor: SchoolActor;
  roomId: string;
  agentName: string;
  task?: RoomTask;
}) {
  const routines = useSchoolRoutines(actor.membershipId);
  const memory = useSchoolMemories(actor.membershipId);
  const items = routines.data?.routines.filter((r) => r.classId === roomId);
  return (
    <aside id="school-activity" className="school-activity team-status" aria-label="กิจกรรมห้อง">
      <h2>งานของ{agentName}ในห้องนี้</h2>
      <section className="status-job">
        {task ? (
          <CurrentTask membershipId={actor.membershipId} task={task} />
        ) : (
          <p>ยังไม่มีงานในบทสนทนานี้</p>
        )}
      </section>
      <h2>นัดไว้แล้ว</h2>
      <section className="status-memory">
        {routines.error ? (
          <p role="alert">{routines.error.message}</p>
        ) : !items ? (
          'กำลังอ่านนัดหมาย…'
        ) : !items.length ? (
          'ยังไม่มีนัดของห้องนี้'
        ) : (
          <ul>
            {items.map((r) => (
              <li key={r.id}>
                เตรียมรายงาน · {String(r.hour).padStart(2, '0')}:{String(r.minute).padStart(2, '0')}{' '}
                น. ทุกวัน · {r.enabled ? 'เปิดอยู่' : 'พักไว้'}
              </li>
            ))}
          </ul>
        )}
      </section>
      <h2>ความจำของบัญชีครู</h2>
      <section className="status-memory">
        {memory.error ? (
          <p role="alert">{memory.error.message}</p>
        ) : !memory.data ? (
          'กำลังอ่านความจำ…'
        ) : !memory.data.items.length ? (
          'ยังไม่มีความจำที่ยืนยันแล้ว'
        ) : (
          <ul>
            {memory.data.items.map((m) => (
              <li key={m.id}>{m.text}</li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
