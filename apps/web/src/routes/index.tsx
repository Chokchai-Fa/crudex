import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({ component: Landing });

function Landing() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted px-5 py-10">
      <section className="mx-auto grid w-full max-w-5xl items-center gap-10 rounded-3xl border bg-card p-7 shadow-sm sm:p-12 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <img
            src="/roles/brand.png"
            alt="Crudex"
            width="148"
            height="32"
            className="rounded dark:bg-white dark:p-1"
          />
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            ผู้ช่วยประจำห้องเรียนของครู
          </h1>
          <p className="max-w-md leading-relaxed text-muted-foreground">
            คุยกับน้องแจ๋วเพื่อเตรียมใบงาน เปิดฟอร์มให้นักเรียน และติดตามผลของแต่ละห้องในที่เดียว
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/school">เข้าสู่พื้นที่โรงเรียน</Link>
            </Button>
          </div>
        </div>
        <div className="grid place-items-center">
          <img src="/team/secretary.svg" alt="เลขาครู" width="144" height="144" />
        </div>
      </section>
    </main>
  );
}
