import { Link, useNavigate } from '@tanstack/react-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Menu, ListChecks } from 'lucide-react';
import type { AgentId, CreateRun, SchoolActor } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { SchoolTeam, SchoolActivity, AssistantIcon } from './chat-panels';
import { ChatArtifacts } from './chat-artifacts';
import { ThemeToggle } from '@/components/theme-toggle';
import { SchoolLogin } from './login';
import { RunDetails, statusLabels, SchoolGradebook } from './classroom';
import {
  readSchoolWorksheet,
  useCreateSchoolRun,
  useSchoolRuns,
  useSchoolSession,
  useSchoolAgents,
} from './api/school';
import { teacherMessage, referencesWorksheet, withWorksheet } from './worksheet-context';
import '../workspace/chat-activity.css';

export function SchoolChat({ initialRoom }: { initialRoom?: string }) {
  const session = useSchoolSession();
  if (session.error) return <p role="alert">{session.error.message}</p>;
  if (session.isPending) return <p role="status">กำลังตรวจสอบบัญชี…</p>;
  if (!session.data) return <SchoolLogin />;
  const { actor } = session.data;
  if (actor.role !== 'teacher')
    return (
      <p>
        บัญชีนี้ไม่มีสิทธิ์เข้าแชตครู · <Link to="/school">กลับพื้นที่โรงเรียน</Link>
      </p>
    );
  return <ClassSelector key={actor.membershipId} actor={actor} initialRoom={initialRoom} />;
}

function ClassSelector({ actor, initialRoom }: { actor: SchoolActor; initialRoom?: string }) {
  const navigate = useNavigate();
  const room = actor.classes.find((c) => c.id === initialRoom) ?? actor.classes[0];
  const [agent, setAgent] = useState<AgentId>('jaew');
  if (!room)
    return (
      <p>
        ยังไม่มีห้องเรียนที่ได้รับมอบหมาย · <Link to="/school">พื้นที่โรงเรียน</Link>
      </p>
    );
  return (
    <ChatRoom
      key={room.id + agent}
      agent={agent}
      onAgent={setAgent}
      actor={actor}
      room={room}
      onRoom={(roomId) => void navigate({ to: '/teacher', search: { roomId } })}
    />
  );
}

function ChatRoom({
  actor,
  room,
  onRoom,
  agent,
  onAgent,
}: {
  actor: SchoolActor;
  agent: AgentId;
  onAgent: (id: AgentId) => void;
  room: SchoolActor['classes'][number];
  onRoom: (id: string) => void;
}) {
  const history = useSchoolRuns(actor.membershipId, agent);
  const create = useCreateSchoolRun(actor.membershipId, agent);
  const directory = useSchoolAgents(actor.membershipId);
  const agentName =
    directory.data?.agents.find((a) => a.id === agent)?.name ??
    (agent === 'jaew' ? 'เลขาครู' : agent);
  const [panel, setPanel] = useState<'chat' | 'team' | 'activity'>('chat');
  const draftKey = ['crudex.school.draft', actor.membershipId, room.id, agent].join('.');
  const [draft, setDraft] = useState(() => sessionStorage.getItem(draftKey) ?? '');
  function editDraft(value: string) {
    setDraft(value);
    if (value) sessionStorage.setItem(draftKey, value);
    else sessionStorage.removeItem(draftKey);
  }
  const teamButton = useRef<HTMLButtonElement>(null);
  const activityButton = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    if (panel === 'chat') return;
    function dismiss(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setPanel('chat');
      (panel === 'team' ? teamButton : activityButton).current?.focus({ preventScroll: true });
    }
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [panel]);

  const [sheet, setSheet] = useState('');
  const [grades, setGrades] = useState(false);
  const retry = useRef<CreateRun | null>(null);
  const busy = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const input = useRef<HTMLTextAreaElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLOListElement>(null);
  const following = useRef(true);
  const runs = (history.data?.runs ?? []).filter((r) => r.classId === room.id).reverse();
  const currentTask =
    runs.findLast((r) => r.status === 'running' || r.status === 'queued') ?? runs.at(-1);
  function insertPrompt(text: string) {
    const next = draft ? draft + '\n' + text : text;
    if (next.length <= 4000) editDraft(next);
    else setSendError('ร่างข้อความยาวเกิน 4,000 ตัวอักษร');
    input.current?.focus({ preventScroll: true });
  }
  function notePosition() {
    const p = viewport.current;
    if (p) following.current = p.scrollHeight - p.clientHeight - p.scrollTop <= 24;
  }
  useLayoutEffect(() => {
    const p = viewport.current,
      list = content.current;
    if (!p || !list) return;
    const observer = new ResizeObserver(() => {
      if (following.current) p.scrollTop = p.scrollHeight;
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const localGatewayUnconfirmed =
    import.meta.env.MODE === 'school-local' &&
    import.meta.env.VITE_SCHOOL_GATEWAY_FIXTURE !== 'false';
  async function send() {
    const prompt = draft.trim();
    if (localGatewayUnconfirmed || !prompt || busy.current) return;
    notePosition();
    busy.current = true;
    setSending(true);
    setSendError('');
    input.current?.focus({ preventScroll: true });
    try {
      if (!retry.current || teacherMessage(retry.current.prompt) !== prompt) {
        let message = prompt;
        if (referencesWorksheet(prompt)) {
          const current = await history.refetch({ throwOnError: true });
          const roomRuns = current.data?.runs.filter((r) => r.classId === room.id) ?? [];
          const latest = roomRuns.find((r) => r.worksheetIds.length)?.worksheetIds.at(-1);
          const openSheet = roomRuns.some((r) => r.worksheetIds.includes(sheet))
            ? sheet
            : undefined;
          const id = /เพิ่งสร้าง|ล่าสุด|เมื่อกี้/u.test(prompt) ? latest : (openSheet ?? latest);
          if (id) message = withWorksheet(prompt, await readSchoolWorksheet(id));
        }
        retry.current = { prompt: message, classId: room.id, clientRequestId: crypto.randomUUID() };
      }
      await create.mutateAsync(retry.current);
      editDraft('');
      retry.current = null;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <main className="teacher-chat school-workspace" data-panel={panel}>
      <SchoolTeam
        actor={actor}
        agent={agent}
        onAgent={(id) => {
          setPanel('chat');
          onAgent(id);
        }}
        roomId={room.id}
        onRoom={(id) => {
          setPanel('chat');
          onRoom(id);
        }}
        disabled={sending}
      />
      <section className="school-conversation">
        <header className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            ref={teamButton}
            aria-label="ห้องและผู้ช่วย"
            aria-expanded={panel === 'team'}
            aria-controls="school-team"
            onClick={() => setPanel(panel === 'team' ? 'chat' : 'team')}
          >
            <Menu />
          </Button>
          <AssistantIcon id={agent} />
          <div>
            <h1 className="text-xl font-bold">{agentName}</h1>
            <p className="text-sm text-muted-foreground">{room.name}</p>
          </div>
          <div className="ms-auto">
            <ThemeToggle />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            ref={activityButton}
            aria-label="กิจกรรมห้อง"
            aria-controls="school-activity"
            aria-expanded={panel === 'activity'}
            onClick={() => setPanel(panel === 'activity' ? 'chat' : 'activity')}
          >
            <ListChecks />
          </Button>
        </header>
        <div
          ref={viewport}
          role="region"
          aria-label={'ประวัติสนทนาห้อง ' + room.name}
          tabIndex={0}
          onScroll={notePosition}
          className="min-h-0 overflow-y-auto overscroll-contain p-3"
        >
          {history.error && <p role="alert">{history.error.message}</p>}
          <Button variant="outline" aria-expanded={grades} onClick={() => setGrades(!grades)}>
            สมุดคะแนน · {room.name}
          </Button>
          {grades && <SchoolGradebook classId={room.id} membershipId={actor.membershipId} />}
          {history.isPending ? (
            <p role="status">กำลังอ่านประวัติ…</p>
          ) : (
            !runs.length && !history.error && <p>เริ่มคำขอแรกสำหรับห้อง {room.name}</p>
          )}
          <ol ref={content} className="space-y-4 py-3">
            {runs.map((run) => (
              <li key={run.id} className="space-y-2">
                <p className="teacher-bubble ms-auto w-fit whitespace-pre-wrap break-words">
                  {teacherMessage(run.prompt)}
                </p>
                <div className="flex items-start gap-2">
                  <AssistantIcon id={run.agentId} />
                  <div className="chat-response min-w-0 rounded-2xl bg-accent px-4 py-3">
                    <RunDetails id={run.id} membershipId={actor.membershipId} status={run.status} />
                  </div>
                </div>
                {run.worksheetIds.map((id) => (
                  <ChatArtifacts
                    key={id}
                    id={id}
                    roomId={room.id}
                    membershipId={actor.membershipId}
                    open={sheet === id}
                    toggle={() => setSheet(sheet === id ? '' : id)}
                  />
                ))}
              </li>
            ))}
          </ol>
        </div>
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          {localGatewayUnconfirmed && <p role="status">ยังไม่ได้เปิดใช้ runtime จริงในเครื่อง</p>}
          {sendError && <p role="alert">{sendError}</p>}
          {sending && <p role="status">กำลังส่งคำขอ…</p>}
          <div className="school-quick-prompts" aria-label="คำสั่งลัด">
            {(agent === 'jaew' || agent === 'jum') && (
              <button
                type="button"
                disabled={sending}
                onClick={() => insertPrompt('ช่วยสร้างใบงานสำหรับห้อง ' + room.name)}
              >
                สร้างใบงาน
              </button>
            )}
            {runs.some((run) => run.worksheetIds.length > 0) && (
              <button
                type="button"
                disabled={sending}
                onClick={() => insertPrompt('ช่วยเฉลยข้อ 1 ของใบงานล่าสุดพร้อมวิธีคิด')}
              >
                ขอเฉลย
              </button>
            )}
          </div>
          <div className="compose-capsule">
            <textarea
              ref={input}
              rows={1}
              aria-label={'คุยกับ' + agentName + ' · ' + room.name}
              placeholder={'พิมพ์คุยกับ' + agentName + '…'}
              maxLength={4000}
              readOnly={sending}
              value={draft}
              onChange={(e) => editDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className="submit-arrow"
              aria-label="ส่งข้อความ"
              disabled={localGatewayUnconfirmed || !draft.trim() || sending}
            >
              <ArrowUp />
            </button>
          </div>
        </form>
      </section>
      <SchoolActivity
        agentName={agentName}
        actor={actor}
        roomId={room.id}
        task={
          currentTask && {
            prompt: teacherMessage(currentTask.prompt),
            status: statusLabels[currentTask.status],
          }
        }
      />
    </main>
  );
}
