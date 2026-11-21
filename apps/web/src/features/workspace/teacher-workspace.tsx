import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
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
    <section className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="เลขาครู"
        description="ครูผู้สอน · บัญชีตัวอย่าง"
        actions={
          <Button asChild variant="outline">
            <Link to="/">สลับบทบาท</Link>
          </Button>
        }
      />
      <div className="flex items-center gap-3">
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
      </div>
      <div className="space-y-3">
        <Label htmlFor="draft">ร่างคำสั่งสำหรับห้อง {room}</Label>
        <Textarea
          id="draft"
          rows={4}
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
              สร้างใบงานตัวอย่าง
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
      <div role="status">{pending[room] && 'กำลังเตรียมใบงานสำหรับ ' + room}</div>
      {request && !pending[room] && (
        <div className="space-y-3">
          <p className="break-words">คำสั่งล่าสุด · {request}</p>
          <div className="grid gap-4 md:grid-cols-2">
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
    </section>
  );
}
