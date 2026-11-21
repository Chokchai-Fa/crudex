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
              <Link to="/sign-in">เข้าสู่ระบบด้วยบัญชีเดโม</Link>
            </Button>
            <details className="text-sm">
              <summary className="cursor-pointer py-3 text-primary underline">ดูวิธีใช้</summary>
              <p className="max-w-sm py-2">
                เลือกบัญชีครู แล้วพิมพ์ “ทำใบงานเศษส่วน” เมื่อได้ชุดแล้ว ลองถาม “อธิบายข้อ 3”
                หรือเปิดควิซได้เลย
              </p>
            </details>
          </div>
          <p className="text-sm text-muted-foreground">
            ทดลองฟรีด้วยข้อมูลตัวอย่าง ไม่ต้องสมัครสมาชิก
          </p>
        </div>
        <div className="space-y-4 rounded-3xl bg-muted p-5 sm:p-8">
          <img src="/agents/jaew.svg" alt="" width="64" height="64" />
          <p className="ms-auto w-fit rounded-2xl rounded-tr-sm bg-accent p-3 text-accent-foreground">
            ช่วยเตรียมใบงานเศษส่วน ป.5 ให้หน่อย
          </p>
          <p className="w-fit rounded-2xl rounded-tl-sm border bg-card p-3">
            ได้ค่ะครู ลองตรวจใบงาน A4 และเปิดฟอร์มตัวอย่างได้เลย
          </p>
        </div>
      </section>
    </main>
  );
}
