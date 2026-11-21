import { Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
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
    setRoom(value);
    setPreviewRoom('');
    setDraft(pending[value] ? '' : (sessionStorage.getItem(draftKey(value)) ?? ''));
  }

  return (
    <main className="teacher-chat grid min-h-dvh content-start gap-3 bg-muted px-2 pb-2 pt-[env(safe-area-inset-top)] sm:px-4 lg:content-stretch lg:grid-cols-[minmax(12rem,22fr)_minmax(0,55fr)_minmax(12rem,23fr)] lg:gap-0 lg:px-0 lg:pb-0 print:block print:min-h-0 print:bg-white print:p-0">
      <RoomNavigation room={room} onRoomChange={switchRoom} />
      <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5 lg:rounded-none lg:border-0 print:border-0 print:p-0">
        <header className="flex items-center gap-3 border-b pb-3">
          <img
            src="/agents/jaew.svg"
            alt=""
            width="48"
            height="48"
            className="size-12 object-contain"
          />
          <div>
            <h1 className="text-2xl font-semibold">น้องแจ๋ว · เลขาครู</h1>
            <p className="text-sm text-muted-foreground">ห้อง {room} · บทสนทนาตัวอย่าง</p>
          </div>
          <div className="ms-auto shrink-0">
            <ThemeToggle />
          </div>
        </header>
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
        {request && (
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
        )}
        <div className="space-y-3 border-t pt-4">
          <Label htmlFor="draft">คุยกับน้องแจ๋ว · ห้อง {room}</Label>
          <Textarea
            id="draft"
            ref={draftInput}
            rows={2}
            className="rounded-xl text-base"
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
      <aside className="space-y-2 rounded-2xl border bg-card p-4 lg:rounded-none lg:border-0 lg:border-s lg:p-5 print:hidden">
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
