import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import type { SchoolActor } from '@repo/shared';
import { CheckCircle2 } from 'lucide-react';
import { ApiError } from '@/lib/api-error';
import { LoadError } from '@/components/load-error';
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
  if (quiz.error) {
    if (quiz.error instanceof ApiError && [400, 403, 404].includes(quiz.error.status)) {
      return (
        <p role="alert">
          เปิดแบบฝึกนี้ไม่ได้ ตรวจสอบว่าลิงก์ถูกต้องและใช้บัญชีของห้องที่ครูมอบหมาย
        </p>
      );
    }
    return (
      <LoadError
        message="โหลดแบบฝึกไม่สำเร็จ"
        busy={quiz.isFetching}
        retry={() => void quiz.refetch()}
      />
    );
  }
  if (!quiz.data) return <p role="status">กำลังเปิดฟอร์ม…</p>;
  if (submit.data)
    return (
      <div
        role="status"
        className="grid justify-items-center gap-2 rounded-xl bg-success-soft p-5 text-center"
      >
        <CheckCircle2 aria-hidden="true" className="size-8 text-success-text" />
        <h2 className="text-lg font-semibold">ส่งคำตอบแล้ว</h2>
        <p>{quiz.data.title}</p>
        <p className="font-semibold">
          คะแนน {submit.data.score} / {submit.data.maxScore}
        </p>
      </div>
    );
  if (submit.error instanceof ApiError && submit.error.status === 409) {
    return (
      <p role="status" className="rounded-xl bg-muted p-4">
        บัญชีนี้ส่งแบบฝึกนี้แล้ว ระบบเก็บคำตอบที่ส่งไว้ครั้งแรก
      </p>
    );
  }
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
      <p className="text-sm text-muted-foreground">
        {preview
          ? 'ตัวอย่างสำหรับครู ส่งลิงก์หน้านี้ให้นักเรียนในห้องเพื่อทำแบบฝึก'
          : `ตอบแล้ว ${Object.keys(answers).length} จาก ${quiz.data.questions.length} ข้อ`}
      </p>
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
      {!preview && (
        <Button disabled={submit.isPending}>
          {submit.isPending ? 'กำลังส่งคำตอบ…' : 'ส่งคำตอบ'}
        </Button>
      )}
      {submit.error && <p role="alert">ส่งคำตอบไม่สำเร็จ ตรวจสอบการเชื่อมต่อแล้วกดส่งอีกครั้ง</p>}
    </form>
  );
}
function SchoolPlay() {
  const { token } = Route.useParams();
  const session = useSchoolSession();
  const logout = useSchoolLogout();
  return (
    <section className="school-flow mx-auto max-w-xl space-y-5 rounded-2xl border bg-card p-5">
      <Link
        to="/school"
        className="inline-flex min-h-11 items-center text-sm text-primary underline"
      >
        กลับพื้นที่โรงเรียน
      </Link>
      <h1 className="text-2xl font-bold">ฟอร์มของห้องเรียน</h1>
      {session.error ? (
        <LoadError
          message="ตรวจสอบบัญชีไม่สำเร็จ"
          busy={session.isFetching}
          retry={() => void session.refetch()}
        />
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
        <div className="space-y-4">
          <p>เข้าสู่ระบบด้วยรหัสเชิญของนักเรียนเพื่อเปิดแบบฝึกนี้</p>
          <SchoolLogin />
        </div>
      )}
    </section>
  );
}
