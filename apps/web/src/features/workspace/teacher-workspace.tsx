import { useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { RoomNavigation } from './room-navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Worksheet } from './worksheet';

import { rooms } from './fraction-set';
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

  const draftInput = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
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

  async function prepareWorksheet() {
    const origin = room;
    const instruction = draft.trim();
    if (!instruction || pending[origin]) return;
    setPending((current) => ({ ...current, [origin]: true }));
    setPreviewRoom('');
    await new Promise((resolve) => setTimeout(resolve, 800));
    sessionStorage.setItem(worksheetKey(origin), instruction);
    updateFormFailure(origin, false);
    setPending((current) => ({ ...current, [origin]: false }));
  }

  function edit(value: string) {
    setDraft(value);
    sessionStorage.setItem(draftKey(room), value);
  }

  function switchRoom(value: string) {
    sessionStorage.setItem(roomKey, value);
    setRoom(value);
    setPreviewRoom('');
    setDraft(sessionStorage.getItem(draftKey(value)) ?? '');
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
        {!request && !pending[room] && (
          <p className="w-fit rounded-2xl rounded-tl-sm bg-muted p-3">
            วันนี้ครูอยากเตรียมอะไรให้ห้อง {room} คะ?
          </p>
        )}
        <div role="status" className="empty:sr-only">
          {pending[room] && 'กำลังเตรียมใบงานและฟอร์มตัวอย่างสำหรับ ' + room}
        </div>
        {request && !pending[room] && (
          <div className="space-y-3">
            <p className="ms-auto w-fit max-w-full break-words rounded-2xl rounded-tr-sm bg-accent p-3 text-accent-foreground">
              คำสั่งล่าสุด · {request}
            </p>
            <div className="flex items-start gap-2">
              <img
                src="/agents/jaew.svg"
                alt=""
                width="32"
                height="32"
                className="size-8 object-contain"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">น้องแจ๋ว</p>
                <p className="mt-1 rounded-2xl rounded-tl-sm bg-muted p-3">
                  ใบงานเศษส่วน ป.5 สำหรับห้อง {room} พร้อมแล้วค่ะ{' '}
                  {formFailed
                    ? 'ฟอร์มจำลองยังไม่พร้อม กด “ลองเตรียมฟอร์มอีกครั้ง” ที่การ์ดฟอร์มได้เลย'
                    : 'เปิดตรวจใบงาน A4 หรือเปิดฟอร์มจำลองได้ด้านล่าง'}
                </p>
                <Button
                  variant="link"
                  className="lg:hidden"
                  onClick={() => draftInput.current?.focus()}
                >
                  กลับไปร่างคำสั่งตัวอย่าง
                </Button>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
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
            </div>
            {previewRoom === room && <Worksheet room={room} />}
          </div>
        )}
        <div className="space-y-3 border-t pt-4">
          <Label htmlFor="draft">ร่างคำสั่งสำหรับห้อง {room}</Label>
          <Textarea
            id="draft"
            ref={draftInput}
            rows={4}
            className="scroll-mt-20 rounded-xl text-base md:text-base"
            placeholder="อยากเตรียมอะไรให้ห้องนี้?"
            value={draft}
            onChange={(event) => edit(event.target.value)}
          />
          <p className="text-muted-foreground text-sm">
            ร่างบันทึกแยกตามห้องในแท็บนี้ ยังไม่ได้ส่งให้ AI
          </p>
          {draft && (
            <>
              <p className="text-muted-foreground text-sm">
                เดโมใช้ชุดเศษส่วน ป.5 จำนวน 10 ข้อเสมอ แม้เปลี่ยนห้องหรือแก้คำสั่ง
              </p>
              <Button
                className="w-full aria-disabled:cursor-wait aria-disabled:opacity-70 sm:w-auto"
                disabled={!draft.trim()}
                aria-disabled={!draft.trim() || !!pending[room]}
                onClick={prepareWorksheet}
              >
                <Send aria-hidden="true" />
                {pending[room] ? 'กำลังเตรียมชุดตัวอย่าง…' : 'สร้างใบงานและฟอร์มตัวอย่าง'}
              </Button>
            </>
          )}
          {!draft && (
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                edit('เตรียมชุดเศษส่วน ป.5 จำนวน 10 ข้อ และฟอร์มจำลองสำหรับห้อง ' + room);
                draftInput.current?.focus();
              }}
            >
              ใช้คำสั่งตัวอย่าง
            </Button>
          )}
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
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            {pending[room] ? 'กำลังเตรียมชุดตัวอย่าง' : 'ยังไม่มีคำสั่งในห้องนี้'}
          </p>
        )}
      </aside>
    </main>
  );
}
