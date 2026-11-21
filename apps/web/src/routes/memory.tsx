import { createFileRoute, Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { rooms } from '@/features/workspace/fraction-set';

export const Route = createFileRoute('/memory')({
  validateSearch: (search): { room: string } => ({
    room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'ป.5/2',
  }),
  component: MemoryPage,
});

const formats = ['ใบงานแบบ 4 ตัวเลือก', 'ใบงานแบบแสดงวิธีทำ', 'ใบงานแบบเติมคำตอบ'] as const;
type Action = 'view' | 'edit' | 'review' | 'remove';

function MemoryPage() {
  const { room } = Route.useSearch();
  return <RoomMemory key={room} room={room} />;
}

function RoomMemory({ room }: { room: string }) {
  const key = 'crudex.demo.memory.format.' + room;
  const [saved, setSaved] = useState(() => {
    const value = sessionStorage.getItem(key);
    return formats.find((format) => format === value) ?? '';
  });
  const [draft, setDraft] = useState(saved || formats[0]);
  const [action, setAction] = useState<Action>('view');
  const [notice, setNotice] = useState('');
  const focusTarget = useRef<HTMLHeadingElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);

  const removeButton = useRef<HTMLButtonElement>(null);

  function go(next: Action, message = '') {
    flushSync(() => {
      setNotice(message);
      setAction(next);
    });
    if (next !== 'view') focusTarget.current?.focus();
    else if (action === 'remove' && removeButton.current) removeButton.current.focus();
    else editButton.current?.focus();
  }

  function save(value: string) {
    try {
      if (value) sessionStorage.setItem(key, value);
      else sessionStorage.removeItem(key);
    } catch {
      setNotice('บันทึกการเปลี่ยนแปลงไม่ได้ โปรดลองอีกครั้ง');
      return;
    }
    setSaved(value);
    go('view', value ? 'บันทึกความชอบของห้องนี้แล้ว' : 'ลบความชอบของห้องนี้แล้ว');
  }

  return (
    <section className="teacher-chat mx-auto max-w-2xl space-y-4 rounded-3xl bg-muted p-4 sm:p-6">
      <Button asChild variant="link" className="px-0">
        <Link
          to="/teacher"
          onClick={() => sessionStorage.setItem('crudex.demo.teacher.room', room)}
        >
          กลับหน้าครู · {room}
        </Link>
      </Button>
      <header className="flex items-center gap-3">
        <img src="/agents/jaew.svg" alt="" width="44" height="44" />
        <div>
          <h1 className="text-2xl font-semibold">ความจำของห้อง {room}</h1>
          <p className="mt-1 text-base leading-relaxed">
            <span className="block">เก็บเฉพาะห้องนี้ในแท็บนี้</span>
            <span className="block">ใบงานตัวอย่างยังเป็นชุดเดิม</span>
          </p>
        </div>
      </header>
      <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
        <h2
          className="rounded text-lg font-semibold focus-visible:outline-2"
          ref={focusTarget}
          tabIndex={-1}
        >
          {action === 'view' && 'รูปแบบใบงานที่ห้องชอบ'}
          {action === 'edit' && 'เลือกรูปแบบใบงาน'}
          {action === 'review' && 'ให้น้องแจ๋วจำไว้สำหรับห้อง ' + room + ' ไหมคะ?'}
          {action === 'remove' && 'ลบความชอบของห้อง ' + room + ' ไหม?'}
        </h2>
        {action === 'view' && (
          <>
            <p>{saved || 'ยังไม่มีรูปแบบใบงานที่ครูยืนยันให้จำ'}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                ref={editButton}
                onClick={() => {
                  setDraft(saved || formats[0]);
                  go('edit');
                }}
              >
                {saved ? 'แก้ไขรูปแบบใบงาน' : 'เสนอความชอบให้เลขาจำ'}
              </Button>
              {saved && (
                <Button ref={removeButton} variant="outline" onClick={() => go('remove')}>
                  ลบความชอบ
                </Button>
              )}
            </div>
          </>
        )}
        {action === 'edit' && (
          <>
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm">รูปแบบที่ห้อง {room} ชอบ</legend>
              {formats.map((format) => (
                <label
                  key={format}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 has-[:checked]:border-primary"
                >
                  <input
                    type="radio"
                    name="format"
                    value={format}
                    checked={draft === format}
                    onChange={() => setDraft(format)}
                  />
                  {format}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => go('review')}>ตรวจข้อความก่อนจำ</Button>
              <Button variant="outline" onClick={() => go('view')}>
                ยกเลิก
              </Button>
            </div>
          </>
        )}
        {(action === 'review' || action === 'remove') && (
          <>
            <p className="rounded-xl bg-muted p-3">
              ห้อง {room} ชอบ{action === 'review' ? draft : saved}
            </p>
            {action === 'review' && saved && saved !== draft && (
              <p className="text-sm">จะแทนที่ความชอบเดิมของห้องนี้ ({saved})</p>
            )}
            <div className="flex flex-wrap gap-2">
              {action === 'review' ? (
                <>
                  <Button onClick={() => save(draft)}>ยืนยันให้จำ</Button>
                  <Button variant="outline" onClick={() => go('view', 'ไม่ได้บันทึกข้อเสนอนี้')}>
                    ไม่จำ
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="destructive" onClick={() => save('')}>
                    ยืนยันลบ
                  </Button>
                  <Button variant="outline" onClick={() => go('view')}>
                    ยกเลิก
                  </Button>
                </>
              )}
            </div>
          </>
        )}
        <p role="status" className="text-sm empty:sr-only">
          {notice}
        </p>
      </div>
    </section>
  );
}
