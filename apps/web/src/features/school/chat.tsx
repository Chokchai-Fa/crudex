import { Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { CreateRun, SchoolActor } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { ThemeToggle } from '@/components/theme-toggle';
import { RunDetails, Worksheet, statusLabels, SchoolGradebook } from './classroom';
import {
  readSchoolWorksheet,
  useCreateSchoolRun,
  useSchoolRuns,
  useSchoolSession,
  useSchoolLogout,
} from './api/school';
import { teacherMessage, referencesWorksheet, withWorksheet } from './worksheet-context';
import '../workspace/chat-activity.css';

export function SchoolChat({ initialRoom }: { initialRoom?: string }) {
  const session = useSchoolSession();
  if (session.error) return <p role="alert">{session.error.message}</p>;
  if (session.isPending) return <p role="status">กำลังตรวจสอบบัญชี…</p>;
  if (!session.data) return <Navigate to="/school" replace />;
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
  if (!room)
    return (
      <p>
        ยังไม่มีห้องเรียนที่ได้รับมอบหมาย · <Link to="/school">พื้นที่โรงเรียน</Link>
      </p>
    );
  return (
    <ChatRoom
      key={room.id}
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
}: {
  actor: SchoolActor;
  room: SchoolActor['classes'][number];
  onRoom: (id: string) => void;
}) {
  const history = useSchoolRuns(actor.membershipId);
  const create = useCreateSchoolRun(actor.membershipId);
  const logout = useSchoolLogout();
  const [draft, setDraft] = useState('');
  const [expanded, setExpanded] = useState('');
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
      const run = await create.mutateAsync(retry.current);
      setExpanded(run.id);
      setDraft('');
      retry.current = null;
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'ส่งคำขอไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      busy.current = false;
      setSending(false);
    }
  }
  return (
    <main className="teacher-chat mx-auto grid h-dvh max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-card">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
        <img src="/team/secretary.svg" alt="" width="40" height="40" />
        <h1 className="font-bold">เลขาครู</h1>
        <label>
          ห้อง{' '}
          <NativeSelect disabled={sending} value={room.id} onChange={(e) => onRoom(e.target.value)}>
            {actor.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </label>
        <div className="ms-auto">
          <ThemeToggle />
        </div>
        <Link className="text-primary underline" to="/school">
          พื้นที่โรงเรียน
        </Link>
        <Button variant="link" disabled={logout.isPending} onClick={() => logout.mutate()}>
          ออกจากระบบ
        </Button>
        {logout.error && <p role="alert">{logout.error.message}</p>}
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
                <img src="/team/secretary.svg" alt="เลขาครู" width="32" height="32" />
                <div className="min-w-0 rounded-2xl bg-muted p-3">
                  <p role="status">{statusLabels[run.status]}</p>
                  <button
                    className="min-h-11 text-primary"
                    aria-expanded={expanded === run.id}
                    onClick={() => setExpanded(expanded === run.id ? '' : run.id)}
                  >
                    {expanded === run.id ? 'ย่อรายละเอียดงาน' : 'ดูรายละเอียดงาน'}
                  </button>
                  {expanded === run.id && <RunDetails key={run.id} id={run.id} />}
                </div>
              </div>
              {run.worksheetIds.map((id, i) => (
                <div key={id}>
                  <Button
                    variant="outline"
                    aria-expanded={sheet === id}
                    onClick={() => setSheet(sheet === id ? '' : id)}
                  >
                    {sheet === id ? 'ปิดใบงาน' : 'เปิดใบงาน ' + (i + 1)}
                  </Button>
                  {sheet === id && <Worksheet membershipId={actor.membershipId} id={id} />}
                </div>
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
        <div className="compose-capsule">
          <textarea
            ref={input}
            rows={1}
            aria-label={'คุยกับเลขาครู · ' + room.name}
            placeholder="พิมพ์คุยกับเลขาครู…"
            maxLength={4000}
            readOnly={sending}

            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
    </main>
  );
}
