import { createFileRoute, Link } from '@tanstack/react-router';
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
  const submitted = rows.filter((row) => row.score !== null);
  const support = rows.filter((row) => row.score !== null && row.score < 5);
  const common = exercises
    .map(([question], i) => ({
      question,
      number: i + 1,
      count: submitted.filter((row) => row.missed?.includes(i + 1)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2);

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <Button variant="link" className="px-0" asChild>
          <Link
            to="/teacher"
            onClick={() => sessionStorage.setItem('crudex.demo.teacher.room', room)}
          >
            กลับหน้าครู
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">ครูผู้สอน · ข้อมูลตัวอย่าง</p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold">
          <img src="/agents/nun.svg" alt="" width="44" height="44" />
          สมุดคะแนน
        </h1>
        {rows.length > 0 && <p>บวกและลบเศษส่วน · 10 ข้อ</p>}
        <p className="text-sm text-muted-foreground">
          คะแนนตัวอย่าง · การส่งฟอร์มจำลองจะไม่เปลี่ยนยอด
        </p>
      </header>
      <label className="flex items-center gap-3">
        ห้องเรียน
        <select
          value={room}
          className="bg-background min-h-11 rounded-md border px-3"
          onChange={(e) => void navigate({ search: { room: e.target.value } })}
        >
          {rooms.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      {rows.length === 0 ? (
        <p className="rounded-xl border p-6">ยังไม่มีชุดคะแนนตัวอย่างสำหรับห้อง {room}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-card rounded-xl border p-5">
              <p>ส่งแล้ว · {room}</p>
              <strong className="text-3xl">
                {submitted.length} / {rows.length}
              </strong>{' '}
              คน
            </div>
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5">
              <p>ต้องติว · คะแนนต่ำกว่า 50%</p>
              <strong className="text-3xl">{support.length}</strong> คน
            </div>
          </div>
          <div>
            <h2 className="mb-2 text-lg font-semibold">ข้อที่ตอบผิดบ่อย</h2>
            <ul>
              {common.map((item) => (
                <li key={item.number}>
                  ข้อ {item.number} · {item.question} · ตอบผิด {item.count} คน
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline">
            <Link to="/reports" search={{ room }}>
              รายงานผู้ปกครอง
            </Link>
          </Button>
          <table className="w-full text-left text-sm">
            <caption className="pb-3 text-left text-lg font-semibold">ผลรายคน · {room}</caption>
            <thead>
              <tr className="bg-muted">
                <th className="p-2">ผู้เรียน</th>
                <th className="p-2">คะแนน / 10</th>
                <th className="p-2">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.number} className="border-b">
                  <th scope="row" className="p-2 font-normal">
                    {row.name}
                  </th>
                  <td className="p-2">{row.score ?? '—'}</td>
                  <td className="p-2">
                    {row.score === null ? 'ยังไม่ส่ง' : row.score < 5 ? 'ต้องติว' : 'ส่งแล้ว'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
