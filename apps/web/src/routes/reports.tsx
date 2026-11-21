import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { classroomResults } from '@/features/workspace/demo-gradebook';
import { rooms } from '@/features/workspace/fraction-set';

export const Route = createFileRoute('/reports')({
  validateSearch: (search) => ({
    room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'ป.5/2',
  }),
  component: Reports,
});

function Reports() {
  const { room } = Route.useSearch();
  return <ReportDraft key={room} room={room} />;
}

function ReportDraft({ room }: { room: string }) {
  const students = classroomResults(room);
  const [number, setNumber] = useState(1);
  const [review, setReview] = useState(false);
  const student = students.find((row) => row.number === number);
  const receiptKey = 'crudex.demo.report.' + room + '.' + number;
  const [receipt, setReceipt] = useState(() => sessionStorage.getItem(receiptKey));
  const destination =
    'family-' + room.replace('ป.', '').replace('/', '-') + '-' + number + '@example.invalid';
  function selectStudent(value: number) {
    setNumber(value);
    setReview(false);
    setReceipt(sessionStorage.getItem('crudex.demo.report.' + room + '.' + value));
  }
  function confirm() {
    const time = new Date().toISOString();
    sessionStorage.setItem(receiptKey, time);
    setReceipt(time);
    setReview(false);
  }
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Link
        to="/gradebook"
        search={{ room }}
        className="inline-flex min-h-11 items-center text-blue-700 underline dark:text-blue-300"
      >
        กลับสมุดคะแนน · {room}
      </Link>
      <header className="space-y-2 rounded-2xl bg-blue-50 p-6 text-blue-950">
        <p>ครูผู้สอน · ห้อง {room}</p>
        <h1 className="text-2xl font-bold">รายงานผู้ปกครอง</h1>
        <p>ใช้ข้อมูลตัวอย่างและจำลองการส่งอีเมลในแท็บนี้</p>
      </header>
      {student ? (
        <>
          <label className="block">
            เลือกครอบครัว
            <select
              className="mt-2 block min-h-11 w-full rounded-lg border bg-background px-3"
              value={number}
              onChange={(e) => selectStudent(Number(e.target.value))}
            >
              {students.map((row) => (
                <option key={row.number} value={row.number}>
                  ผู้ปกครองของ{row.name}
                </option>
              ))}
            </select>
          </label>
          {receipt ? (
            <p role="status">
              ส่งจำลองแล้ว · {destination} · {new Date(receipt).toLocaleString('th-TH')}
            </p>
          ) : review ? (
            <article className="space-y-4 rounded-xl border p-5">
              <h2 className="text-xl font-semibold">ตรวจร่างก่อนส่ง · 1 ครอบครัว</h2>
              <p className="break-words">
                ถึง ผู้ปกครองของ{student.name} · {destination}
              </p>
              <h3 className="font-semibold">ผลแบบฝึกบวกและลบเศษส่วน ห้อง {room}</h3>
              <p>เรียนผู้ปกครองของ{student.name}</p>
              <p>
                {student.score === null
                  ? 'ขณะนี้ยังไม่มีคำตอบของนักเรียนในชุดตัวอย่างนี้'
                  : 'นักเรียนทำแบบฝึกได้ ' + student.score + ' จาก 10 คะแนน'}
              </p>
              {student.missed && student.missed.length > 0 && (
                <p>ข้อที่แนะนำให้ทบทวนร่วมกัน ได้แก่ {student.missed.join(', ')}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setReview(false)}>
                  ยกเลิก
                </Button>
                <Button onClick={confirm}>ยืนยันส่งจำลอง 1 ครอบครัว</Button>
              </div>
            </article>
          ) : (
            <Button onClick={() => setReview(true)}>ตรวจรายงานก่อนส่ง</Button>
          )}
        </>
      ) : (
        <p>ยังไม่มีข้อมูลตัวอย่างสำหรับจัดทำรายงานห้อง {room}</p>
      )}
    </section>
  );
}
