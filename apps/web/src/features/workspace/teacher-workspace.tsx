import { Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { BookOpen, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { Worksheet } from './worksheet';

import { rooms } from './fraction-set';
import { FormCard } from './form-card';

const roomKey = 'crudex.demo.teacher.room';
const draftKey = (room: string) => 'crudex.demo.teacher.draft.' + room;

export function TeacherWorkspace() {
  const [room, setRoom] = useState(() => {
    const saved = sessionStorage.getItem(roomKey);
    return saved && rooms.includes(saved) ? saved : 'ป.5/2';
  });
  const [draft, setDraft] = useState(() => sessionStorage.getItem(draftKey(room)) ?? '');

  const draftInput = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [previewRoom, setPreviewRoom] = useState('');
  const worksheetKey = (name: string) => 'crudex.demo.worksheet.' + name;
  const request = sessionStorage.getItem(worksheetKey(room));

  async function prepareWorksheet() {
    const origin = room;
    const instruction = draft.trim();
    if (!instruction || pending[origin]) return;
    setPending((current) => ({ ...current, [origin]: true }));
    setPreviewRoom('');
    await new Promise((resolve) => setTimeout(resolve, 800));
    sessionStorage.setItem(worksheetKey(origin), instruction);
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
    <section className="teacher-chat grid items-start gap-3 rounded-3xl bg-muted p-2 sm:gap-4 sm:p-5 lg:grid-cols-[10rem_minmax(0,1fr)_11rem] print:block print:bg-white print:p-0">
      <nav
        aria-label="พื้นที่ครู"
        className="grid grid-cols-[1fr_auto] items-center gap-x-2 px-1 lg:flex lg:flex-col lg:items-stretch lg:gap-3 print:hidden"
      >
        <p className="text-sm font-semibold">
          ครูผู้สอน <span className="text-muted-foreground font-normal">· บัญชีตัวอย่าง</span>
        </p>
        <Link
          to="/"
          className="inline-flex min-h-11 items-center justify-end text-sm underline lg:order-last lg:justify-start"
        >
          สลับบทบาท
        </Link>
        <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
          <Label htmlFor="room">ห้อง</Label>
          <select
            id="room"
            value={room}
            onChange={(event) => switchRoom(event.target.value)}
            className="bg-background h-11 rounded-xl border px-2"
          >
            {rooms.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <Button asChild variant="outline">
          <Link to="/gradebook" search={{ room }}>
            <BookOpen aria-hidden="true" />
            สมุดคะแนน
          </Link>
        </Button>
      </nav>
      <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5 print:border-0 print:p-0">
        <header className="flex items-center gap-3 border-b pb-3">
          <img
            src="/roles/teacher.png"
            alt=""
            width="48"
            height="48"
            className="size-12 rounded-full object-cover"
          />
          <div>
            <h1 className="text-2xl font-semibold">เลขาครู</h1>
            <p className="text-sm text-muted-foreground">ห้อง {room} · บทสนทนาตัวอย่าง</p>
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
                src="/roles/teacher.png"
                alt=""
                width="32"
                height="32"
                className="size-8 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold">เลขาครู</p>
                <p className="mt-1 rounded-2xl rounded-tl-sm bg-muted p-3">
                  เตรียมชุดเศษส่วนให้ห้อง {room} แล้วค่ะ ตรวจใบงาน A4 และฟอร์มจำลองได้ด้านล่าง
                </p>
                <Button
                  variant="link"
                  className="lg:hidden"
                  onClick={() => draftInput.current?.focus()}
                >
                  พิมพ์คำสั่งต่อ
                </Button>
              </div>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <article className="space-y-3 rounded-2xl border p-4">
                <h2 className="font-semibold">ใบงาน A4 · {room}</h2>
                <p className="text-sm">บวกและลบเศษส่วน · 10 ข้อ</p>
                <Button
                  variant="outline"
                  aria-expanded={previewRoom === room}
                  onClick={() => setPreviewRoom(previewRoom === room ? '' : room)}
                >
                  {previewRoom === room ? 'ปิดตัวอย่าง' : 'ตรวจใบงาน'} · {room}
                </Button>
              </article>
              <FormCard key={room} room={room} />
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
                className="w-full sm:w-auto"
                disabled={!draft.trim() || pending[room]}
                onClick={prepareWorksheet}
              >
                <Send aria-hidden="true" />
                สร้างใบงานและฟอร์มตัวอย่าง
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
      <aside className="space-y-2 rounded-2xl border bg-card p-4 print:hidden">
        <h2 className="font-semibold">สถานะงาน · {room}</h2>
        <p className="text-sm text-muted-foreground">
          {pending[room]
            ? 'กำลังเตรียมชุดตัวอย่าง'
            : request
              ? 'เตรียมใบงานแล้ว'
              : 'ยังไม่มีคำสั่งในห้องนี้'}
        </p>
      </aside>
    </section>
  );
}
