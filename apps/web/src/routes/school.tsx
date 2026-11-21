import { GuestRolePicker } from '@/features/school/login';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { SchoolClassroom } from '@/features/school/classroom';
import { useSchoolBrief, useSchoolLogout, useSchoolSession } from '@/features/school/api/school';

export const Route = createFileRoute('/school')({ component: School });
function Brief({ membershipId }: { membershipId: string }) {
  const brief = useSchoolBrief(membershipId);
  if (brief.error) return <p role="alert">{brief.error.message}</p>;
  if (!brief.data) return <p role="status">กำลังอ่านสรุปโรงเรียน…</p>;
  const b = brief.data;
  return (
    <section className="school-panel brief-card space-y-4">
      <div className="flex items-center gap-3">
        <img src="/agents/rungchao.svg" width="44" height="44" alt="" />
        <h2 className="grow text-lg font-bold">สรุปเช้า · {b.date}</h2>
        <span className="badge-sample">ข้อมูลตัวอย่าง</span>
      </div>
      <dl className="brief-tiles">
        {[
          ['ห้องเรียน', b.classes],
          ['นักเรียน', b.students],
          ['ส่งงานวันนี้', b.submissions],
          ['คะแนนเฉลี่ย', b.averagePercent === null ? 'ยังไม่มีคะแนน' : b.averagePercent + '%'],
          ['รายงานวันนี้', b.reports],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd data-text={typeof value === 'string' ? '' : undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="brief-foot">ภาพรวมระดับห้อง · ไม่มีคะแนนรายคน</p>
    </section>
  );
}
function School() {
  const session = useSchoolSession();
  const logout = useSchoolLogout();
  const me = session.data;
  if (!session.error && !session.isPending && !me)
    return (
      <div className="school-flow mx-auto max-w-4xl">
        <GuestRolePicker />
      </div>
    );
  return (
    <div className="school-flow school-page mx-auto space-y-5">
      <PageHeader
        title="พื้นที่โรงเรียน"
        description={me?.memberships.find((m) => m.id === me.actor.membershipId)?.schoolName}
      />
      {session.error ? (
        <div role="alert">
          {session.error.message}{' '}
          <Button variant="outline" onClick={() => void session.refetch()}>
            ลองอีกครั้ง
          </Button>
        </div>
      ) : session.isPending || !me ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : (
        <>
          <div className="school-bar">
            <img src="/roles/brand.png" width="146" height="32" alt="Crudex" />
            <p className="grow font-semibold">
              {me.actor.displayName}{' '}
              <span className="badge-sample ms-1 align-middle">ข้อมูลตัวอย่าง</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              ออกจากบัญชีโรงเรียน
            </Button>
          </div>
          {logout.error && <p role="alert">{logout.error.message}</p>}
          {me.actor.role === 'teacher' ? (
            <SchoolClassroom key={me.actor.membershipId} actor={me.actor} />
          ) : me.actor.role === 'principal' ? (
            <Brief membershipId={me.actor.membershipId} />
          ) : (
            <p>พื้นที่นี้รองรับบัญชีครูและผู้อำนวยการ</p>
          )}
        </>
      )}
    </div>
  );
}
