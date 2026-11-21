import { createFileRoute, Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { classroomResults } from '@/features/workspace/demo-gradebook';
import { exercises, rooms } from '@/features/workspace/fraction-set';

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
  const returnToPreview = useRef(false);
  const focusReceipt = useRef(false);
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
    focusReceipt.current = true;
    setReceipt(time);
    setReview(false);
  }
  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <Link
        to="/gradebook"
        search={{ room }}
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline"
      >
        กลับสมุดคะแนน · {room}
      </Link>
      <header className="space-y-2 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">ครูผู้สอน · ห้อง {room}</p>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-bold">รายงานผู้ปกครอง</h1>
        <p>ใช้ข้อมูลตัวอย่างและจำลองการส่งอีเมลในแท็บนี้</p>
      </header>
      {student ? (
        <>
          <label className="block rounded-2xl border bg-card p-5">
            เลือกครอบครัว
            <NativeSelect
              className="mt-2 w-full"
              value={number}
              onChange={(e) => selectStudent(Number(e.target.value))}
            >
              {students.map((row) => (
                <option key={row.number} value={row.number}>
                  ผู้ปกครองของ{row.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          {receipt ? (
            <p
              role="status"
              tabIndex={-1}
              ref={(node) => {
                if (node && focusReceipt.current) {
                  node.focus();
                  focusReceipt.current = false;
                }
              }}
            >
              ส่งจำลองแล้ว · {destination} · {new Date(receipt).toLocaleString('th-TH')}
            </p>
          ) : review ? (
            <article className="space-y-4 rounded-2xl border bg-card p-5">
              <h2
                tabIndex={-1}
                ref={(node) => {
                  node?.focus();
                }}
                className="text-xl font-semibold"
              >
                ตรวจร่างก่อนส่ง · 1 ครอบครัว
              </h2>
              <div className="rounded-lg bg-muted p-3">
                <p>ถึง ผู้ปกครองของ{student.name}</p>
                <p className="break-words text-sm">{destination}</p>
              </div>
              <h3 className="font-semibold">ผลแบบฝึกบวกและลบเศษส่วน ห้อง {room}</h3>
              <p>เรียนผู้ปกครองของ{student.name}</p>
              <p>
                {student.score === null
                  ? 'ขณะนี้ยังไม่มีคำตอบของนักเรียนในชุดตัวอย่างนี้'
                  : 'นักเรียนทำแบบฝึกได้ ' + student.score + ' จาก 10 คะแนน'}
              </p>
              {student.missed && student.missed.length > 0 && (
                <div>
                  <h4 className="font-semibold">ฝึกเพิ่มเติมที่บ้าน</h4>
                  <p>
                    ลองทำข้อ {student.missed[0]} ({exercises[(student.missed[0] ?? 1) - 1]?.[0]})
                    ด้วยกัน ให้นักเรียนอธิบายวิธีทำตัวส่วนให้เท่ากันก่อนหาคำตอบ
                  </p>
                  <p className="mt-2 text-sm">ข้อที่ควรทบทวน · {student.missed.join(', ')}</p>
                </div>
              )}
              {student.score === 10 && (
                <p>
                  นักเรียนตอบถูกครบทั้ง 10 ข้อ ลองให้เลือกข้อที่ชอบหนึ่งข้อแล้วอธิบายวิธีคิดให้ฟัง
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    returnToPreview.current = true;
                    setReview(false);
                  }}
                >
                  ยกเลิก
                </Button>
                <Button onClick={confirm}>ยืนยันส่งจำลอง 1 ครอบครัว</Button>
              </div>
            </article>
          ) : (
            <Button
              ref={(node) => {
                if (node && returnToPreview.current) {
                  node.focus();
                  returnToPreview.current = false;
                }
              }}
              onClick={() => setReview(true)}
            >
              ตรวจรายงานก่อนส่ง
            </Button>
          )}
        </>
      ) : (
        <p>ยังไม่มีข้อมูลตัวอย่างสำหรับจัดทำรายงานห้อง {room}</p>
      )}
    </section>
  );
}
