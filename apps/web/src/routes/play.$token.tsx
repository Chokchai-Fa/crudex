import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { SchoolActor } from '@repo/shared';
import { Button } from '@/components/ui/button';
import { SchoolLogin } from '@/features/school/login';
import {
  useSchoolSession,
  useSchoolLogout,
  useSchoolQuiz,
  useSubmitSchoolQuiz,
} from '@/features/school/api/school';

export const Route = createFileRoute('/play/$token')({ component: SchoolPlay });
function Quiz({ actor, token }: { actor: SchoolActor; token: string }) {
  const quiz = useSchoolQuiz(actor.membershipId, token);
  const submit = useSubmitSchoolQuiz(token);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  if (quiz.error) return <p role="alert">{quiz.error.message}</p>;
  if (!quiz.data) return <p role="status">กำลังเปิดฟอร์ม…</p>;
  if (submit.data)
    return (
      <p role="status">
        ส่งคำตอบแล้ว · คะแนน {submit.data.score} / {submit.data.maxScore}
      </p>
    );
  const preview = actor.role !== 'student';
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!preview) submit.mutate(answers);
      }}
    >
      <h2 className="text-xl font-bold">{quiz.data.title}</h2>
      {preview && <p>ตัวอย่างสำหรับครู ใช้ลิงก์หน้านี้ให้นักเรียนในห้องส่งคำตอบ</p>}
      {quiz.data.questions.map((q, i) => (
        <fieldset
          key={q.id}
          disabled={preview || submit.isPending}
          className="rounded-xl border p-4"
        >
          <legend>
            {i + 1}. {q.text}
          </legend>
          {q.choices.map((c) => (
            <label className="flex min-h-11 items-center gap-2" key={c.id}>
              <input
                type="radio"
                name={q.id}
                value={c.id}
                required
                checked={answers[q.id] === c.id}
                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: c.id }))}
              />
              {c.text}
            </label>
          ))}
        </fieldset>
      ))}
      {!preview && <Button disabled={submit.isPending}>ส่งคำตอบ</Button>}
      {submit.error && <p role="alert">{submit.error.message}</p>}
    </form>
  );
}
function SchoolPlay() {
  const { token } = Route.useParams();
  const session = useSchoolSession();
  const logout = useSchoolLogout();
  return (
    <section className="school-flow mx-auto max-w-xl space-y-5 rounded-2xl border bg-card p-5">
      <Link to="/school" className="text-sm text-primary underline">
        กลับพื้นที่โรงเรียน
      </Link>
      <h1 className="text-2xl font-bold">ฟอร์มของห้องเรียน</h1>
      {session.error ? (
        <p role="alert">{session.error.message}</p>
      ) : session.isPending ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : session.data ? (
        <>
          <p>{session.data.actor.displayName}</p>
          <Quiz
            key={session.data.actor.membershipId + token}
            token={token}
            actor={session.data.actor}
          />
          <Button variant="outline" disabled={logout.isPending} onClick={() => logout.mutate()}>
            ออกจากบัญชีโรงเรียน
          </Button>
          {logout.error && <p role="alert">{logout.error.message}</p>}
        </>
      ) : (
        <SchoolLogin />
      )}
    </section>
  );
}
