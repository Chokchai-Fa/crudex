import { GuestRolePicker } from '@/features/school/login';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/page-header';
import { BriefLines, WatchPanel, readBriefExtras } from '@/features/school/principal-brief';
import { SchoolClassroom } from '@/features/school/classroom';
import { useSchoolBrief, useSchoolLogout, useSchoolSession } from '@/features/school/api/school';
import { roles } from '@/features/school-access/roles';
import { LoadError } from '@/components/load-error';
import { BrandLogo } from '@/components/brand-logo';

export const Route = createFileRoute('/school')({ component: School });
function Brief({ membershipId }: { membershipId: string }) {
  const brief = useSchoolBrief(membershipId);
  if (brief.error)
    return (
      <LoadError
        message="โหลดสรุปโรงเรียนไม่สำเร็จ"
        retry={() => void brief.refetch()}
        busy={brief.isFetching}
      />
    );
  if (!brief.data) return <p role="status">กำลังอ่านสรุปโรงเรียน…</p>;
  const b = brief.data;
  const { brief: published, flagged } = readBriefExtras(b);
  const card = (
    <section className="school-panel brief-card space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <img src="/agents/rungchao.svg" width="44" height="44" alt="" />
        <h2 className="grow text-lg font-bold">{published?.title ?? 'สรุปเช้า'}</h2>
        <time className="badge-date" dateTime={b.date}>
          {new Date(b.date + 'T00:00:00+07:00').toLocaleDateString('th-TH', {
            dateStyle: 'medium',
            timeZone: 'Asia/Bangkok',
          })}
        </time>
      </div>
      {published ? (
        <BriefLines brief={published} />
      ) : (
        <p className="text-sm text-muted-foreground">
          ยังไม่มีสรุปเช้าสำหรับวันนี้ ดูภาพรวมโรงเรียนได้ด้านล่าง
        </p>
      )}
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
  if (!flagged) return card;
  return (
    <div className="brief-layout">
      {card}
      <WatchPanel flagged={flagged} />
    </div>
  );
}
function School() {
  const session = useSchoolSession();
  const logout = useSchoolLogout();
  const me = session.data;
  if (!session.error && !session.isPending && !me)
    return (
      <div className="school-flow school-entry mx-auto max-w-4xl">
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
        <LoadError
          message="เชื่อมต่อพื้นที่โรงเรียนไม่สำเร็จ"
          busy={session.isFetching}
          retry={() => void session.refetch()}
        />
      ) : session.isPending || !me ? (
        <p role="status">กำลังตรวจสอบบัญชี…</p>
      ) : (
        <>
          <div className="school-bar">
            <Link
              to="/"
              className="inline-flex min-h-11 items-center"
              aria-label="crudex · กลับหน้าแรก"
            >
              <BrandLogo size={30} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{me.actor.displayName}</p>
              <p className="text-sm text-muted-foreground">{roles[me.actor.role]}</p>
            </div>
            <div className="col-span-full flex flex-wrap items-center gap-2">
              <Button asChild variant="link" size="sm">
                <Link to="/account">บัญชีโรงเรียน</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
              >
                ออกจากบัญชีโรงเรียน
              </Button>
            </div>
          </div>
          {logout.error && <p role="alert">{logout.error.message}</p>}
          {me.actor.role === 'teacher' ? (
            <SchoolClassroom key={me.actor.membershipId} actor={me.actor} />
          ) : me.actor.role === 'principal' ? (
            <Brief membershipId={me.actor.membershipId} />
          ) : (
            <section className="school-panel">
              {me.actor.role === 'student'
                ? 'เปิดลิงก์แบบฝึกที่ครูส่งให้เพื่อทำและส่งคำตอบ'
                : 'ดูรายชื่อนักเรียนในความดูแลได้ที่หน้าบัญชีโรงเรียน'}
            </section>
          )}
        </>
      )}
    </div>
  );
}
