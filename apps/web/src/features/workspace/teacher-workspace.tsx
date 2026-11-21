import { Link } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Menu, Send } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { RoomNavigation } from './room-navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { chatKey, readConversation, replyTo } from './demo-chat';
import { Worksheet } from './worksheet';

import { rooms } from './fraction-set';
import { QuizCard } from './quiz-card';
import { FormCard } from './form-card';

const roomKey = 'crudex.demo.teacher.room';
const draftKey = (room: string) => 'crudex.demo.teacher.draft.' + room;

const formFailureKey = (room: string) => 'crudex.demo.form-failed.' + room;

export function TeacherWorkspace() {
  const [room, setRoom] = useState(() => {
    const saved = sessionStorage.getItem(roomKey);
    return saved && rooms.includes(saved) ? saved : 'ป.5/2';
  });
  const [draft, setDraft] = useState(() => sessionStorage.getItem(draftKey(room)) ?? '');

  const [history, setHistory] = useState(() =>
    Object.fromEntries(rooms.map((name) => [name, readConversation(name)])),
  );
  const turns = history[room] ?? [];
  const timers = useRef(new Map<string, number>());
  useEffect(() => {
    const active = timers.current;
    return () => {
      for (const id of active.values()) window.clearTimeout(id);
    };
  }, []);
  const draftInput = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [failedForms, setFailedForms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      rooms.map((name) => [name, sessionStorage.getItem(formFailureKey(name)) === '1']),
    ),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const pendingPrompt = pending[room];
  useLayoutEffect(() => {
    const panel = viewport.current;
    if (panel && following.current) panel.scrollTop = panel.scrollHeight;
  }, [room, turns.length, pendingPrompt]);

  const formFailed = failedForms[room] ?? false;
  const [previewRoom, setPreviewRoom] = useState('');
  const worksheetKey = (name: string) => 'crudex.demo.worksheet.' + name;
  const request = sessionStorage.getItem(worksheetKey(room));

  function updateFormFailure(name: string, failed: boolean) {
    if (failed) sessionStorage.setItem(formFailureKey(name), '1');
    else sessionStorage.removeItem(formFailureKey(name));
    setFailedForms((current) => ({ ...current, [name]: failed }));
  }

  function sendMessage() {
    const origin = room;
    const prompt = draft.trim();
    if (!prompt || timers.current.has(origin)) return;
    const previous = history[origin] ?? [];
    const turn = replyTo(prompt, origin, previous, Boolean(request));
    setPending((current) => ({ ...current, [origin]: prompt }));
    setDraft('');
    draftInput.current?.focus();
    const id = window.setTimeout(() => {
      timers.current.delete(origin);
      const conversation = [...previous, turn];
      sessionStorage.setItem(chatKey(origin), JSON.stringify(conversation));
      if (turn.kind === 'worksheet') {
        sessionStorage.setItem(worksheetKey(origin), prompt);
        updateFormFailure(origin, false);
      }
      if (sessionStorage.getItem(draftKey(origin)) === draft)
        sessionStorage.removeItem(draftKey(origin));
      setHistory((current) => ({ ...current, [origin]: conversation }));
      setPending((current) => ({ ...current, [origin]: '' }));
    }, 600);
    timers.current.set(origin, id);
  }

  function edit(value: string) {
    setDraft(value);
    sessionStorage.setItem(draftKey(room), value);
  }

  function switchRoom(value: string) {
    sessionStorage.setItem(roomKey, value);
    following.current = true;
    setMenuOpen(false);
    setRoom(value);
    setPreviewRoom('');
    setDraft(pending[value] ? '' : (sessionStorage.getItem(draftKey(value)) ?? ''));
  }

  const latestWorksheet = turns.map((turn) => turn.kind).lastIndexOf('worksheet');
  const artifacts = request && (
    <div id="room-artifacts" className="space-y-3">
      {formFailed && (
        <p role="status">ใบงานพร้อม · ฟอร์มจำลองยังไม่พร้อม ลองใหม่ที่การ์ดฟอร์มได้ค่ะ</p>
      )}
      <div className="grid gap-3 xl:grid-cols-3">
        <article className="space-y-3 rounded-2xl border p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <img src="/agents/jum.svg" alt="" width="32" height="32" />
            ใบงาน A4 · {room}
          </h2>
          <p className="text-sm">บวกและลบเศษส่วน · 10 ข้อ</p>
          <Button
            variant="outline"
            aria-expanded={previewRoom === room}
            onClick={() => setPreviewRoom(previewRoom === room ? '' : room)}
          >
            {previewRoom === room ? 'ปิดตัวอย่าง' : 'ตรวจใบงาน'} · {room}
          </Button>
        </article>
        <FormCard
          key={room}
          room={room}
          failed={formFailed}
          onFailureChange={(failed) => updateFormFailure(room, failed)}
        />
        <QuizCard key={'quiz-' + room} room={room} />
      </div>
      {previewRoom === room && <Worksheet room={room} />}
    </div>
  );

  return (
    <main className="teacher-chat grid h-dvh min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-muted pt-[env(safe-area-inset-top)] lg:grid-rows-[minmax(0,1fr)] lg:grid-cols-[minmax(12rem,22fr)_minmax(0,55fr)_minmax(12rem,23fr)] lg:gap-0 lg:px-0 lg:pb-0 print:block print:h-auto print:overflow-visible print:min-h-0 print:bg-white print:p-0">
      <div
        id="teacher-room-menu"
        className={
          (menuOpen ? 'block' : 'hidden') +
          ' row-start-1 max-h-[30dvh] overflow-y-auto overscroll-contain lg:col-start-1 lg:block lg:max-h-full print:hidden'
        }
      >
        <RoomNavigation room={room} onRoomChange={switchRoom} />
      </div>
      <div className="row-start-2 grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-card lg:col-start-2 lg:row-start-1 print:block">
        <header className="flex items-center gap-2 border-b px-3 py-2 sm:gap-3 sm:px-5">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="เมนูห้องเรียน"
            aria-expanded={menuOpen}
            aria-controls="teacher-room-menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu aria-hidden="true" />
          </Button>
          <img
            src="/agents/jaew.svg"
            alt=""
            width="48"
            height="48"
            className="size-9 object-contain sm:size-12"
          />
          <div>
            <h1 className="text-lg font-semibold sm:text-2xl">น้องแจ๋ว · เลขาครู</h1>
            <p className="text-sm text-muted-foreground">ห้อง {room} · บทสนทนาตัวอย่าง</p>
          </div>
          <div className="ms-auto shrink-0">
            <ThemeToggle />
          </div>
        </header>
        <div
          ref={viewport}
          role="region"
          aria-label={'ประวัติสนทนาห้อง ' + room}
          tabIndex={0}
          className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 outline-offset-[-2px] sm:px-5 print:overflow-visible print:p-0"
          onScroll={(event) => {
            const panel = event.currentTarget;
            following.current = panel.scrollHeight - panel.scrollTop - panel.clientHeight <= 24;
          }}
        >
          {latestWorksheet < 0 && artifacts}
          {!request && !turns.length && !pending[room] && (
            <p className="w-fit rounded-2xl rounded-tl-sm bg-muted p-3">
              วันนี้ครูอยากเตรียมอะไรให้ห้อง {room} คะ?
            </p>
          )}
          <ol aria-label={'บทสนทนาห้อง ' + room} className="space-y-5">
            {turns.map((turn, i) => (
              <li key={i} className="space-y-2">
                <p className="ms-auto w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-accent p-3 text-accent-foreground">
                  {turn.prompt}
                </p>
                <div className="flex items-start gap-2">
                  <img src="/agents/jaew.svg" alt="น้องแจ๋ว" width="32" height="32" />
                  <div className="min-w-0 space-y-2">
                    <p className="rounded-2xl rounded-tl-sm bg-muted p-3">{turn.answer}</p>
                    {turn.kind === 'scores' && (
                      <Button asChild variant="outline">
                        <Link to="/gradebook" search={{ room }}>
                          เปิดสมุดคะแนน · {room}
                        </Link>
                      </Button>
                    )}
                    {turn.kind === 'report' && (
                      <Button asChild variant="outline">
                        <Link to="/reports" search={{ room }}>
                          ตรวจร่างรายงาน · {room}
                        </Link>
                      </Button>
                    )}
                    {(turn.kind === 'worksheet' || turn.kind === 'exercise') && (
                      <a
                        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                        href="#room-artifacts"
                      >
                        ดูผลงานชุดนี้
                      </a>
                    )}
                  </div>
                </div>
                {i === latestWorksheet && artifacts}
              </li>
            ))}
          </ol>
          {pending[room] && (
            <p className="ms-auto w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl bg-accent p-3 text-accent-foreground">
              {pending[room]}
            </p>
          )}
          <p role="status" className="text-sm text-muted-foreground empty:sr-only">
            {pending[room]
              ? 'น้องแจ๋วกำลังตอบ…'
              : turns.length > 0
                ? 'ตอบแล้ว · ถามต่อในห้องนี้ได้'
                : ''}
          </p>
        </div>
        <div className="space-y-1.5 border-t px-3 pt-2 pb-[max(.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-3">
          <Label htmlFor="draft" className="sr-only">
            คุยกับน้องแจ๋ว · ห้อง {room}
          </Label>
          <Textarea
            id="draft"
            ref={draftInput}
            rows={2}
            className="min-h-11 max-h-[14dvh] resize-none rounded-xl text-base"
            placeholder={
              request ? 'ถามต่อเกี่ยวกับใบงาน เช่น อธิบายข้อ 3' : 'วันนี้อยากให้ช่วยเตรียมอะไรคะ?'
            }
            value={draft}
            onChange={(event) => edit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                sendMessage();
              }
            }}
          />
          <p className="text-muted-foreground text-sm">
            แชตจำลอง · ใช้ใบงานเศษส่วน ป.5 ชุดตัวอย่างและข้อมูลของห้องนี้
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!draft.trim() || !!pending[room]} onClick={sendMessage}>
              <Send aria-hidden="true" />
              ส่งข้อความ
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                edit(
                  request
                    ? 'ช่วยอธิบายข้อ 3 ของใบงานเดิม'
                    : 'เตรียมใบงานเศษส่วน ป.5 จำนวน 10 ข้อ และฟอร์มสำหรับห้อง ' + room,
                );
                draftInput.current?.focus();
              }}
            >
              ใช้คำสั่งตัวอย่าง
            </Button>
          </div>
        </div>
      </div>
      <aside className="hidden space-y-2 overflow-y-auto border-s bg-card p-5 lg:col-start-3 lg:row-start-1 lg:block print:hidden">
        <h2 className="font-semibold">สถานะงาน · {room}</h2>
        {request && !pending[room] ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">ใบงาน A4</dt>
              <dd>พร้อมตรวจ</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ฟอร์มจำลอง</dt>
              <dd>{formFailed ? 'เตรียมไม่สำเร็จ · ลองใหม่ได้' : 'พร้อมเปิด'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ควิซจำลอง</dt>
              <dd>พร้อมเปิดโจทย์</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {pending[room] ? 'กำลังตอบคำขอ' : 'ยังไม่ได้สร้างใบงานในห้องนี้'}
          </p>
        )}
      </aside>
    </main>
  );
}
