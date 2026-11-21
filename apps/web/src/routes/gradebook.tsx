import { createFileRoute, Link } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { exercises, rooms } from '@/features/workspace/fraction-set';
import { classroomResults } from '@/features/workspace/demo-gradebook';

export const Route = createFileRoute('/gradebook')({
  validateSearch: (search): { room: string } => ({
    room: typeof search.room === 'string' && rooms.includes(search.room) ? search.room : 'ป.5/2',
  }),
  component: Gradebook,
});

function Gradebook() {
  const { room } = Route.useSearch();
  const navigate = Route.useNavigate();
  const rows = classroomResults(room);
  const rememberRoom = () => sessionStorage.setItem('crudex.demo.teacher.room', room);

  return (
    <section className="gradebook mx-auto max-w-4xl space-y-3 rounded-3xl bg-muted p-3 sm:p-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="link" className="px-0">
            <Link to="/teacher" onClick={rememberRoom}>
              กลับหน้าครู
            </Link>
          </Button>
          <label className="flex items-center gap-2 text-sm">
            ห้องเรียน
            <select
              value={room}
              className="min-h-11 rounded-xl border bg-card px-2"
              onChange={(e) => void navigate({ search: { room: e.target.value } })}
            >
              {rooms.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex items-center gap-3">
          <img src="/agents/nun.svg" alt="" width="44" height="44" />
          <div>
            <h1 className="text-2xl font-semibold">สมุดคะแนน</h1>
            {rows.length > 0 && <p className="text-sm">บวกและลบเศษส่วน · 10 ข้อ</p>}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          คะแนนตัวอย่าง · การส่งฟอร์มจำลองจะไม่เปลี่ยนยอด
        </p>
      </header>
      {rows.length ? (
        <RoomScores key={room} room={room} rows={rows} />
      ) : (
        <div className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-semibold">ยังไม่มีชุดคะแนนตัวอย่างสำหรับห้อง {room}</h2>
          <p className="text-sm">ครูลองเตรียมใบงานเศษส่วน ป.5 ในห้องนี้ได้</p>
          <Button asChild>
            <Link to="/teacher" onClick={rememberRoom}>
              กลับไปเตรียมชุดตัวอย่าง
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}

function RoomScores({ room, rows }: { room: string; rows: ReturnType<typeof classroomResults> }) {
  const [supportOnly, setSupportOnly] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const submitted = rows.filter((row) => row.score !== null);
  const support = submitted.filter((row) => row.score !== null && row.score < 5);
  const common = exercises
    .map(([question], i) => ({
      question,
      number: i + 1,
      count: submitted.filter((row) => row.missed?.includes(i + 1)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);
  const visible = supportOnly ? support : rows;

  function showStudents(onlySupport: boolean) {
    flushSync(() => setSupportOnly(onlySupport));
    heading.current?.focus();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="rounded-2xl border bg-card p-3 sm:p-5">
          <p className="text-sm">ส่งแล้ว · {room}</p>
          <strong className="text-2xl tabular-nums sm:text-3xl">
            {submitted.length}/{rows.length}
          </strong>{' '}
          คน
        </div>
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-3 sm:p-5">
          <p className="text-sm">ต้องติว</p>
          <strong className="text-2xl tabular-nums sm:text-3xl">{support.length}</strong> คน
          <p className="text-xs">คะแนนต่ำกว่า 50%</p>
          {support.length > 0 && (
            <Button
              variant="link"
              className="h-auto px-0 underline"
              onClick={() => showStudents(true)}
            >
              ดู {support.length} คนที่ต้องติว
            </Button>
          )}
        </div>
      </div>
      {common.length > 0 && (
        <section className="rounded-2xl border bg-card px-4 py-3">
          <h2 className="font-semibold">ข้อที่ตอบผิดบ่อย</h2>
          <ul className="space-y-1 text-sm">
            {common.map((item) => (
              <li key={item.number}>
                ข้อ {item.number} · {item.question} · ตอบผิด {item.count} คน
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="rounded-2xl border bg-card p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2
            id="score-list"
            tabIndex={-1}
            ref={heading}
            className="scroll-mt-20 rounded text-lg font-semibold focus-visible:outline-2"
          >
            {supportOnly ? 'ผู้เรียนที่ต้องติว' : 'ผลรายคน'} · {room} · {visible.length} คน
          </h2>
          {supportOnly && (
            <Button variant="outline" onClick={() => showStudents(false)}>
              ดูทั้งหมด {rows.length} คน
            </Button>
          )}
          <Button asChild>
            <Link to="/reports" search={{ room }}>
              รายงานผู้ปกครอง
            </Link>
          </Button>
        </div>
        <table aria-labelledby="score-list" className="w-full text-left text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="p-2">ผู้เรียน</th>
              <th className="p-2">คะแนน / 10</th>
              <th className="p-2">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.number} className="border-b last:border-0">
                <th scope="row" className="p-2 font-normal">
                  {row.name}
                </th>
                <td className="p-2 tabular-nums">{row.score ?? '—'}</td>
                <td className="p-2">
                  {row.score === null ? 'ยังไม่ส่ง' : row.score < 5 ? 'ต้องติว' : 'ส่งแล้ว'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
