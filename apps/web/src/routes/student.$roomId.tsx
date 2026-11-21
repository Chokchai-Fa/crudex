import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { exercises, rooms } from '@/features/workspace/fraction-set';

export const Route = createFileRoute('/student/$roomId')({ component: StudentPage });

function StudentPage() {
  const { roomId } = Route.useParams();
  const room = rooms.find((name) => name.replace('ป.', '').replace('/', '-') === roomId);
  return room ? <Quiz key={room} room={room} /> : <h1>ไม่พบฟอร์มสำหรับห้องนี้</h1>;
}

function Quiz({ room }: { room: string }) {
  const [score, setScore] = useState<number | null>(null);
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <header className="space-y-2 border-b pb-5">
        <p className="text-sm">ฟอร์มจำลอง · ห้อง {room}</p>
        <h1 className="text-2xl font-semibold">บวกและลบเศษส่วน</h1>
        <p>คณิตศาสตร์ ป.5 · 10 ข้อ</p>
      </header>
      {score !== null ? (
        <div role="status" className="space-y-2 rounded-lg border p-5">
          <h2 className="font-semibold">ทำแบบฝึกเสร็จแล้ว · {score} / 10 คะแนน</h2>
          <p>ผลตัวอย่างแสดงในหน้านี้เท่านั้น ยังไม่ได้บันทึกเข้าสมุดคะแนนครู</p>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setScore(exercises.filter(([, answer], i) => data.get('q' + i) === answer).length);
            window.scrollTo(0, 0);
          }}
        >
          <label className="block">
            ชื่อผู้ทำ (ใช้ชื่อสมมติ)
            <input
              required
              pattern=".*\S.*"
              autoComplete="off"
              className="mt-2 block w-full rounded-md border p-3"
            />
          </label>
          {exercises.map(([question, answer], i) => {
            const alternatives = exercises
              .map(([, value]) => value)
              .filter((value) => value !== answer);
            const choices = [answer, ...new Set(alternatives)].slice(0, 3);
            const ordered = choices.slice(i % 3).concat(choices.slice(0, i % 3));
            return (
              <fieldset key={question} className="rounded-lg border p-4">
                <legend className="px-1 font-medium">
                  ข้อ {i + 1} · {question} = ?
                </legend>
                {ordered.map((choice) => (
                  <label key={choice} className="flex min-h-11 cursor-pointer items-center gap-3">
                    <input required type="radio" name={'q' + i} value={choice} />
                    {choice}
                  </label>
                ))}
              </fieldset>
            );
          })}
          <Button type="submit">ส่งคำตอบจำลอง</Button>
        </form>
      )}
    </section>
  );
}
