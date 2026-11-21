import { Link } from '@tanstack/react-router';
import { useState } from 'react';
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
    <section className="grid items-start gap-4 rounded-3xl bg-blue-50/60 p-3 dark:bg-slate-900 sm:p-5 lg:grid-cols-[10rem_minmax(0,1fr)_11rem] print:block print:bg-white print:p-0">
      <nav
        aria-label="พื้นที่ครู"
        className="flex flex-wrap items-center gap-3 lg:flex-col lg:items-stretch print:hidden"
      >
        <div className="flex items-center gap-2">
          <img src="/roles/teacher.png" alt="" width="36" height="36" className="rounded-xl" />
          <div>
            <p className="font-bold">ครูผู้สอน</p>
            <p className="text-muted-foreground text-sm">บัญชีตัวอย่าง</p>
          </div>
        </div>
        <Label htmlFor="room">ห้องเรียน</Label>
        <select
          id="room"
          value={room}
          onChange={(event) => switchRoom(event.target.value)}
          className="bg-background h-11 rounded-md border px-3"
        >
          {rooms.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <Button asChild variant="outline">
          <Link to="/gradebook" search={{ room }}>
            สมุดคะแนน
          </Link>
        </Button>
        <Link to="/" className="inline-flex min-h-11 items-center text-sm underline">
          สลับบทบาท
        </Link>
      </nav>
      <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5 print:border-0 print:p-0">
        <header className="border-b pb-3">
          <p className="text-sm text-muted-foreground">ห้อง {room} · บทสนทนาตัวอย่าง</p>
          <h1 className="text-2xl font-bold">เลขาครู</h1>
        </header>
        {!request && !pending[room] && (
          <p className="w-fit rounded-2xl rounded-tl-sm bg-blue-50 p-3 text-blue-950">
            วันนี้ครูอยากเตรียมอะไรให้ห้อง {room} คะ?
          </p>
        )}
        <div role="status">{pending[room] && 'กำลังเตรียมใบงานสำหรับ ' + room}</div>
        {request && !pending[room] && (
          <div className="space-y-3">
            <p className="ms-auto w-fit max-w-full break-words rounded-2xl rounded-tr-sm bg-blue-100 p-3 text-blue-950">
              คำสั่งล่าสุด · {request}
            </p>
            <div className="grid gap-4 xl:grid-cols-2">
              <article className="space-y-3 rounded-lg border p-4">
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
        <div className="space-y-3 rounded-2xl border p-3">
          <Label htmlFor="draft">ร่างคำสั่งสำหรับห้อง {room}</Label>
          <Textarea
            id="draft"
            rows={4}
            className="md:text-base"
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
              <Button disabled={!draft.trim() || pending[room]} onClick={prepareWorksheet}>
                สร้างใบงานและฟอร์มตัวอย่าง
              </Button>
            </>
          )}
          {!draft && (
            <Button
              onClick={() =>
                edit('เตรียมชุดเศษส่วน ป.5 จำนวน 10 ข้อ และฟอร์มจำลองสำหรับห้อง ' + room)
              }
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
