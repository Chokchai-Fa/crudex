import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { answerChoices, exercises, rooms } from '@/features/workspace/fraction-set';

export const Route = createFileRoute('/student/$roomId')({ component: StudentPage });

function StudentPage() {
  const { roomId } = Route.useParams();
  const room = rooms.find((name) => name.replace('ป.', '').replace('/', '-') === roomId);
  return room ? (
    <Quiz key={room} room={room} />
  ) : (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-card p-5">
      <h1 className="text-2xl font-semibold">ไม่พบฟอร์มสำหรับห้องนี้</h1>
      <Button asChild variant="outline">
        <Link to="/">กลับหน้าแรก</Link>
      </Button>
    </section>
  );
}

function Quiz({ room }: { room: string }) {
  const [score, setScore] = useState<number | null>(null);
  const [missing, setMissing] = useState<string>();
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <header className="space-y-2 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">ฟอร์มจำลอง · ห้อง {room}</p>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-semibold">บวกและลบเศษส่วน</h1>
        <p>คณิตศาสตร์ ป.5 · 10 ข้อ</p>
      </header>
      {score !== null ? (
        <div role="status" className="space-y-2 rounded-2xl border bg-card p-5">
          <h2
            tabIndex={-1}
            ref={(node) => {
              node?.focus();
            }}
            className="font-semibold"
          >
            ทำแบบฝึกเสร็จแล้ว · {score} / 10 คะแนน
          </h2>
          <p>ผลตัวอย่างแสดงในหน้านี้เท่านั้น ยังไม่ได้บันทึกเข้าสมุดคะแนนครู</p>
        </div>
      ) : (
        <form
          noValidate
          className="space-y-5"
          onChange={(e) => {
            const field = e.target;
            if (!(field instanceof HTMLInputElement)) return;
            if (field.name === missing && field.value.trim()) setMissing(undefined);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const firstMissing = !String(data.get('name') ?? '').trim()
              ? 'name'
              : exercises.map((_, i) => 'q' + i).find((key) => !data.has(key));
            setMissing(firstMissing);
            if (firstMissing) {
              event.currentTarget
                .querySelector<HTMLInputElement>('[name="' + firstMissing + '"]')
                ?.focus();
              return;
            }
            setScore(exercises.filter(([, answer], i) => data.get('q' + i) === answer).length);
            window.scrollTo(0, 0);
          }}
        >
          <label className="block">
            ชื่อผู้ทำ (ใช้ชื่อสมมติ)
            <input
              required
              name="name"
              aria-invalid={missing === 'name'}
              aria-describedby={missing === 'name' ? 'missing-name' : undefined}
              pattern=".*\S.*"
              autoComplete="off"
              className="mt-2 block w-full rounded-xl border bg-card p-3"
            />
            {missing === 'name' && (
              <span role="alert" id="missing-name">
                กรุณากรอกชื่อผู้ทำแบบฝึก
              </span>
            )}
          </label>
          {exercises.map(([question, answer], i) => {
            const ordered = answerChoices(answer, i, 3);
            return (
              <fieldset key={question} className="bg-card rounded-2xl border p-4 shadow-sm">
                <legend className="px-1 font-medium">
                  ข้อ {i + 1} · {question} = ?
                </legend>
                {ordered.map((choice) => (
                  <label
                    key={choice}
                    className="my-1 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 has-checked:border-primary has-checked:bg-accent"
                  >
                    <input
                      aria-describedby={missing === 'q' + i ? 'missing-question' : undefined}
                      required
                      className="accent-primary"
                      type="radio"
                      name={'q' + i}
                      value={choice}
                    />
                    {choice}
                  </label>
                ))}
                {missing === 'q' + i && (
                  <p id="missing-question" role="alert">
                    กรุณาเลือกคำตอบข้อ {i + 1}
                  </p>
                )}
              </fieldset>
            );
          })}
          <Button type="submit">ส่งคำตอบจำลอง</Button>
        </form>
      )}
      <Link to="/" className="inline-flex min-h-11 items-center text-sm text-primary underline">
        กลับหน้าแรก
      </Link>
    </section>
  );
}
