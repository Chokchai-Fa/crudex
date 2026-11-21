import { BrandLogo } from '@/components/brand-logo';
import { Link } from '@tanstack/react-router';
import type { AgentId, SchoolActor } from '@repo/shared';
import { TeamIcon } from '../workspace/teacher-team';
import {
  useSchoolAgents,
  useSchoolMemories,
  useSchoolRoutines,
  useSchoolLogout,
} from './api/school';

const roles: Partial<Record<AgentId, string>> = {
  jaew: 'ประสานงานและจดจำให้ครู',
  jum: 'ใบงาน แบบฝึกหัด และข้อสอบ',
  jeng: 'สื่อการสอน เกม และกิจกรรม',
  porn: 'เอกสารเบิกและงานอนุมัติ',
  nun: 'วิเคราะห์คะแนนนักเรียนและห้องเรียน',
};
const icons = { jaew: 'secretary', jum: 'paper', jeng: 'notebook', porn: 'envelope' } as const;
export function AssistantIcon({ id }: { id: AgentId }) {
  if (id === 'nun') return <img src="/agents/nun.svg" width="40" height="40" alt="" />;
  return <TeamIcon name={icons[id as keyof typeof icons] ?? 'secretary'} />;
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
  const logout = useSchoolLogout();
  return (
    <nav id="school-team" className="school-team team-nav" aria-label="ห้องและผู้ช่วย">
      <Link to="/school">
        <BrandLogo width="146" height="32" alt="Crudex · พื้นที่โรงเรียน" />
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
        {directory.data?.agents.map((a) => (
          <button
            key={a.id}
            disabled={disabled}
            aria-pressed={agent === a.id}
            className={'team-row w-full text-start ' + (agent === a.id ? 'current' : '')}
            onClick={() => onAgent(a.id)}
          >
            <AssistantIcon id={a.id} />
            <div>
              <strong>{a.name}</strong>
              <small>{roles[a.id]}</small>
            </div>
          </button>
        ))}
      </div>
      <div className="account-panel">
        <strong>{actor.displayName}</strong>
        <Link to="/school">พื้นที่โรงเรียน</Link>
        <button disabled={logout.isPending || disabled} onClick={() => logout.mutate()}>
          ออกจากระบบ
        </button>
        {logout.error && <p role="alert">{logout.error.message}</p>}
      </div>
    </nav>
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
  task?: { prompt: string; status: string };
}) {
  const routines = useSchoolRoutines(actor.membershipId);
  const memory = useSchoolMemories(actor.membershipId);
  const items = routines.data?.routines.filter((r) => r.classId === roomId);
  return (
    <aside id="school-activity" className="school-activity team-status" aria-label="กิจกรรมห้อง">
      <h2>งานของ{agentName}ในห้องนี้</h2>
      <section className="status-job">
        {task ? (
          <>
            <strong>{task.status}</strong>
            <p>{task.prompt}</p>
          </>
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
