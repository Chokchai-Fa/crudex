import { Link } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Clock3, Menu } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { TeamIcon, TeacherTeam, TeamStatus } from './teacher-team';
import { classroomResults } from './demo-gradebook';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { chatKey, readConversation, replyTo } from './demo-chat';
import { Worksheet } from './worksheet';
import './chat-activity.css';

import { exercises, rooms } from './fraction-set';
import { QuizCard } from './quiz-card';
import { FormCard } from './form-card';

const roomKey = 'crudex.demo.teacher.room';
const draftKey = (room: string) => 'crudex.demo.teacher.draft.' + room;

const formFailureKey = (room: string) => 'crudex.demo.form-failed.' + room;

function isNearBottom(panel: HTMLDivElement) {
  return panel.scrollHeight - panel.scrollTop - panel.clientHeight <= 24;
}

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
  const [activeTurn, setActiveTurn] = useState('');
  const [quizStep, setQuizStep] = useState(-1);
  const [quizOpen, setQuizOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const pendingPrompt = pending[room];
  const prompts = turns.map((turn) => turn.prompt);
  if (pendingPrompt) prompts.push(pendingPrompt);
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
    // A scroll event can still be queued when the teacher presses Send.
    if (viewport.current) following.current = isNearBottom(viewport.current);
    const previous = history[origin] ?? [];
    setActiveTurn(origin + '-' + previous.length);
    setPending((current) => ({ ...current, [origin]: prompt }));
    const steps = ['รับคำขอในห้อง ' + origin];
    setDraft('');
    draftInput.current?.focus({ preventScroll: true });
    const id = window.setTimeout(() => {
      timers.current.delete(origin);
      const turn = replyTo(prompt, origin, previous, Boolean(request));
      steps.push('เตรียมคำตอบจากข้อมูลตัวอย่างแล้ว');
      if (turn.kind === 'worksheet') {
        sessionStorage.setItem(worksheetKey(origin), prompt);
        steps.push('เก็บชุดใบงานไว้ในห้องนี้แล้ว');
        updateFormFailure(origin, false);
      }
      if (sessionStorage.getItem(draftKey(origin)) === draft)
        sessionStorage.removeItem(draftKey(origin));
      const conversation = [...previous, { ...turn, steps }];
      sessionStorage.setItem(chatKey(origin), JSON.stringify(conversation));
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
    setActiveTurn('');
    setMenuOpen(false);
    setRoom(value);
    setQuizStep(-1);
    setQuizOpen(false);
    setPreviewRoom('');
    setDraft(pending[value] ? '' : (sessionStorage.getItem(draftKey(value)) ?? ''));
  }

  const quickPrompts = [
    request
      ? ['อธิบายข้อ 7', 'ช่วยอธิบายข้อ 7']
      : ['ทำใบงาน', 'ช่วยทำใบงานเศษส่วน ป.5 จำนวน 10 ข้อ พร้อมฟอร์มและควิซ'],
    ['ดูคะแนน', 'ใครต้องติว'],
    ['ร่างรายงาน', 'เปิดร่างรายงานผู้ปกครอง'],
  ] as const;
  const students = classroomResults(room);
  const submitted = students.filter((s) => s.score !== null).length;
  const support = students.filter((s) => s.score !== null && s.score < 5).length;
  useLayoutEffect(() => {
    const input = draftInput.current;
    if (!input) return;
    const resize = () => {
      input.style.height = 'auto';
      input.style.height = input.scrollHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [draft]);
  const latestWorksheet = turns.map((turn) => turn.kind).lastIndexOf('worksheet');
  const artifacts = request && (
    <div id="room-artifacts" className="chat-artifacts space-y-3">
      {formFailed && (
        <p role="status">ใบงานพร้อม · ฟอร์มจำลองยังไม่พร้อม ลองใหม่ที่การ์ดฟอร์มได้ค่ะ</p>
      )}
      <div className="artifact-byline">
        <TeamIcon name="paper" size={27} />
        <span>น้องกระดาษ · สื่อของห้อง {room}</span>
      </div>
      <div className="output-grid">
        <article className="output-card sheet-output">
          <div className="mini-page" aria-hidden="true">
            <b>ใบงาน เศษส่วน ป.5</b>
            <small>ชื่อ………… เลขที่……</small>
            {exercises.slice(0, 3).map(([q], i) => (
              <span key={q}>
                {i + 1}) {q} = ___
              </span>
            ))}
          </div>
          <h2>ใบงาน A4</h2>
          <div className="card-actions">
            <Button
              onClick={() => {
                flushSync(() => setPreviewRoom(room));
                window.print();
              }}
            >
              พิมพ์
            </Button>
            <Button
              variant="outline"
              aria-label={(previewRoom === room ? 'ปิดตัวอย่าง' : 'ตรวจใบงาน') + ' · ' + room}
              aria-expanded={previewRoom === room}
              onClick={() => setPreviewRoom(previewRoom === room ? '' : room)}
            >
              {previewRoom === room ? 'ปิด' : 'ดูทั้งหมด'}
            </Button>
          </div>
        </article>
        <FormCard
          key={room}
          room={room}
          failed={formFailed}
          onFailureChange={(failed) => updateFormFailure(room, failed)}
        />
        <article className="output-card quiz-output">
          <div className="mini-page" aria-hidden="true">
            <b>ควิซสด · เศษส่วน</b>
            <div className="preview-choices swatches">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <h2>ควิซสด</h2>
          <div className="card-actions">
            <Button
              aria-expanded={quizOpen}
              onClick={() => {
                if (quizStep < 0) setQuizStep(0);
                setQuizOpen(!quizOpen);
              }}
            >
              {quizOpen ? 'ย่อควิซ' : quizStep < 0 ? 'เริ่มควิซ' : 'เปิดควิซ'}
            </Button>
          </div>
        </article>
      </div>
      {quizOpen && <QuizCard key={room} room={room} step={quizStep} setStep={setQuizStep} />}
      {previewRoom === room && <Worksheet room={room} />}
      <div className="score-line">
        <TeamIcon name="notebook" size={27} />
        <section className="score-summary">
          <h2>
            คะแนนเข้าแล้ว {submitted}/{students.length} คน
          </h2>
          <div className="score-tiles">
            {[
              [submitted - support, 'ผ่านแล้ว'],
              [support, 'ต้องติว'],
              [students.length - submitted, 'ยังไม่ส่ง'],
            ].map(([n, label]) => (
              <div key={label}>
                <b>{n}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <Link to="/gradebook" search={{ room }}>
            ดูรายชื่อในสมุดคะแนน →
          </Link>
        </section>
      </div>
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
        <TeacherTeam
          room={room}
          changeRoom={switchRoom}
          submitted={submitted}
          hasSet={!!request}
          working={!!pendingPrompt}
        />
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
            src="/team/secretary.svg"
            alt=""
            width="48"
            height="48"
            className="size-9 object-contain sm:size-12"
          />
          <div>
            <h1 className="text-lg font-semibold sm:text-2xl">เลขาครู</h1>
            <p className="text-sm text-muted-foreground">
              <span className="availability-dot" />{' '}
              {pendingPrompt ? 'กำลังเตรียมคำตอบ' : 'ว่าง คุยได้เลย'} · {room}
              {!menuOpen && <span className="lg:hidden"> · บัญชีตัวอย่าง</span>}
            </p>
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
            following.current = isNearBottom(event.currentTarget);
          }}
        >
          {latestWorksheet < 0 && artifacts}
          {!request && !turns.length && !pending[room] && (
            <p className="w-fit rounded-2xl rounded-tl-sm bg-muted p-3">
              วันนี้ครูอยากเตรียมอะไรให้ห้อง {room} คะ?
            </p>
          )}
          <ol aria-label={'บทสนทนาห้อง ' + room} className="space-y-5">
            {prompts.map((prompt, i) => {
              const turn = turns[i];
              const turnKey = room + '-' + i;
              return (
                <li
                  key={turnKey}
                  className={turnKey === activeTurn ? 'chat-turn-active space-y-2' : 'space-y-2'}
                >
                  <p className="teacher-bubble ms-auto w-fit whitespace-pre-wrap break-words">
                    {prompt}
                  </p>
                  <div className="flex items-start gap-2">
                    <img
                      src="/team/secretary.svg"
                      alt="เลขาครู"
                      width="32"
                      height="32"
                      className="shrink-0"
                    />
                    <div className="min-w-0 space-y-1">
                      <div
                        key={turn ? 'ready' : 'working'}
                        className="chat-response w-fit rounded-2xl rounded-tl-sm bg-muted px-3 py-2.5"
                      >
                        {turn ? (
                          <p>{turn.answer}</p>
                        ) : (
                          <p className="flex items-center gap-2">
                            <Clock3 aria-hidden="true" className="size-4 shrink-0 text-primary" />
                            กำลังเตรียมคำตอบ…
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {i === latestWorksheet && artifacts}
                  {turn?.steps && turn.steps.length > 0 && (
                    <details className="text-sm text-muted-foreground">
                      <summary className="w-fit cursor-pointer py-2 font-medium">
                        รายละเอียดการทำงาน
                      </summary>
                      <ol className="list-decimal space-y-1 ps-6">
                        {turn.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                  {turn?.kind === 'scores' && (
                    <Button asChild variant="outline">
                      <Link to="/gradebook" search={{ room }}>
                        เปิดสมุดคะแนน · {room}
                      </Link>
                    </Button>
                  )}
                  {turn?.kind === 'report' && (
                    <Button asChild variant="outline">
                      <Link to="/reports" search={{ room }}>
                        ตรวจร่างรายงาน · {room}
                      </Link>
                    </Button>
                  )}
                  {(turn?.kind === 'exercise' ||
                    (turn?.kind === 'worksheet' && i !== latestWorksheet)) &&
                    request && (
                      <a
                        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
                        href="#room-artifacts"
                      >
                        ดูผลงานชุดนี้
                      </a>
                    )}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="chat-compose">
          <p role="status" className="sr-only">
            {pendingPrompt ? 'เลขาครูกำลังเตรียมคำตอบ' : turns.length ? 'เลขาครูตอบแล้ว' : ''}
          </p>
          <Label htmlFor="draft" className="sr-only">
            คุยกับเลขาครู · ห้อง {room}
          </Label>
          <div className="prompt-chips">
            {quickPrompts.map(([label, prompt]) => (
              <button
                key={label}
                onClick={() => {
                  edit(prompt);
                  draftInput.current?.focus({ preventScroll: true });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="compose-capsule">
            <textarea
              id="draft"
              ref={draftInput}
              rows={1}
              placeholder="พิมพ์คุยกับเลขาครู…"
              value={draft}
              onChange={(e) => edit(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button
              className="submit-arrow"
              aria-label="ส่งข้อความ"
              disabled={!draft.trim() || !!pendingPrompt}
              onClick={sendMessage}
            >
              <ArrowUp size={22} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <TeamStatus
        room={room}
        hasSet={!!request}
        working={!!pendingPrompt}
        failed={formFailed}
        step={quizStep}
      />
    </main>
  );
}
