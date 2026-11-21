import { Link } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

import { BrandLogo } from '@/components/brand-logo';
import { initMotion } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * crudex landing page from Paper "00 Landing · จอคอม" (≥ md) and "00m Landing · มือถือ" (< md).
 * Every name, number and chat line on this page is sample data.
 */

const ink = 'text-[#152238]';
const body = 'text-[#4A5675]';
const muted = 'text-[#6B7A99]';

type AgentId = 'jaew' | 'jum' | 'jeng' | 'porn' | 'nun' | 'rungchao' | 'lekha_por';

const team: { id: AgentId; name: string; role: string; short: string }[] = [
  {
    id: 'jaew',
    name: 'น้องแจ๋ว · เลขาครู',
    role: 'รับเรื่องจากครู แบ่งงานให้ทีม แล้วสรุปกลับมาในแชตเดียว',
    short: 'รับเรื่อง แบ่งงานให้ทีม สรุปในแชตเดียว',
  },
  {
    id: 'jum',
    name: 'น้องจ๋า',
    role: 'ใบงาน PDF, ข้อสอบ และ Google Form ตามตัวชี้วัด สพฐ.',
    short: 'ใบงาน PDF ข้อสอบ และ Google Form',
  },
  {
    id: 'jeng',
    name: 'พี่เจ๋ง',
    role: 'สไลด์สอน และเกม Kahoot',
    short: 'สไลด์สอน และเกม Kahoot',
  },
  {
    id: 'porn',
    name: 'ป้าพร',
    role: 'เอกสารเบิก คิดยอดไม่เกินงบ ส่งให้ ผอ. อนุมัติ',
    short: 'เอกสารเบิก คิดยอดไม่เกินงบ',
  },
  {
    id: 'nun',
    name: 'น้องนุ่น',
    role: 'สรุปคะแนนห้อง หาเด็กที่ต้องติว',
    short: 'สรุปคะแนนห้อง หาเด็กที่ต้องติว',
  },
  {
    id: 'rungchao',
    name: 'รุ่งเช้า · ฝั่ง ผอ.',
    role: 'สรุปเช้าให้ ผอ. ไม่เกิน 7 บรรทัด',
    short: 'สรุปเช้าให้ ผอ. ไม่เกิน 7 บรรทัด',
  },
  {
    id: 'lekha_por',
    name: 'ลุงนิต · ฝั่ง ผอ.',
    role: 'กล่องอนุมัติของ ผอ. รวมเอกสารที่รอเซ็นไว้ที่เดียว',
    short: 'กล่องอนุมัติของ ผอ.',
  },
];

function Mascot({ id, size, className }: { id: AgentId; size: number; className?: string }) {
  return (
    <img
      src={`/agents/${id}.svg`}
      width={size}
      height={size}
      alt=""
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}

function Cta({
  children,
  to = '/school',
  tone = 'dark',
  className,
}: {
  children: ReactNode;
  to?: '/school' | '/account';
  tone?: 'dark' | 'yellow';
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        'm-press inline-flex items-center justify-center min-h-11 rounded-full font-semibold transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F6BFF]',
        tone === 'dark' && 'bg-[#152238] text-white',
        tone === 'yellow' && cn('bg-[#FFD43B]', ink),
        className,
      )}
    >
      {children}
    </Link>
  );
}

function SoftButton({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        'm-press inline-flex items-center justify-center rounded-full bg-[#F2F5FB] font-semibold hover:opacity-90',
        ink,
        className,
      )}
    >
      {children}
    </a>
  );
}

/* ---------- sample chat used inside the browser (desktop) and phone (mobile) frames ---------- */

function ChatSample({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn('flex flex-col', compact ? 'gap-3 px-4 py-4' : 'gap-4 px-6 py-5')}>
      <div className="flex justify-end">
        <div
          className={cn(
            'max-w-[85%] rounded-[18px] rounded-br-md bg-[#2F6BFF] text-white',
            compact ? 'px-3.5 py-2.5 text-[15px]/5.75' : 'px-4 py-3 text-[15px]/5.75',
          )}
        >
          ทำใบงานพีทาโกรัส ม.2/1 สัก 10 ข้อ + Google Form + เกม Kahoot
        </div>
      </div>
      <div className="flex items-end gap-2">
        <Mascot id="jaew" size={compact ? 22 : 26} />
        <div
          className={cn(
            'rounded-[18px] rounded-bl-md bg-[#F2F5FB]',
            ink,
            compact ? 'px-3.5 py-2.5 text-[15px]/5.75' : 'px-4 py-3 text-[15px]/5.75',
          )}
        >
          ได้เลยค่ะครู! น้องจ๋าทำใบงานกับฟอร์ม พี่เจ๋งทำเกม ส่งกลับมาในแชตนี้
        </div>
      </div>
      <div className={cn('flex flex-col gap-2.5', compact ? 'pl-7' : 'pl-8')}>
        <ArtifactRow color="green" label="ใบงาน A4 · PDF" action="พิมพ์" icon="jum" />
        <ArtifactRow color="blue" label="Google Form · 10 ข้อ" action="ก๊อปลิงก์" icon="jum" />
        <ArtifactRow color="yellow" label="เกม Kahoot" action="เปิด" icon="jeng" />
      </div>
      {!compact && (
        <div className="flex items-end gap-2">
          <Mascot id="nun" size={26} />
          <div
            className={cn(
              'rounded-[18px] rounded-bl-md bg-[#F2F5FB] px-4 py-3 text-[15px]/5.75',
              ink,
            )}
          >
            ม.2/1 ทำแล้ว 18/20 คน · ข้อนำไปใช้ในชีวิตจริงยังถูกน้อย แนะนำติว 4 คน
          </div>
        </div>
      )}
    </div>
  );
}

function ArtifactRow({
  color,
  label,
  action,
  icon,
}: {
  color: 'green' | 'blue' | 'yellow';
  label: string;
  action: string;
  icon: AgentId;
}) {
  const tone = {
    green: { bg: 'bg-[#E6F7EF]', pill: 'bg-[#18B87A]' },
    blue: { bg: 'bg-[#E9EFFF]', pill: 'bg-[#2F6BFF]' },
    yellow: { bg: 'bg-[#FFF8D6]', pill: 'bg-[#C99A00]' },
  }[color];
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl px-3 py-2.5', tone.bg)}>
      <Mascot id={icon} size={30} />
      <div className={cn('grow basis-0 text-[15px]/4.5 font-bold', ink)}>{label}</div>
      <div className={cn('rounded-full px-3 py-1 text-[13px]/4 font-bold text-white', tone.pill)}>
        {action}
      </div>
    </div>
  );
}

function BrowserMock() {
  return (
    <div className="relative z-[2] flex h-full w-full max-w-295 flex-col overflow-clip rounded-t-[20px] bg-white [box-shadow:#15223840_0px_20px_60px]">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#E3EAF6] px-4">
        <span className="size-2.75 rounded-md bg-[#FF5F57]" />
        <span className="size-2.75 rounded-md bg-[#FEBC2E]" />
        <span className="size-2.75 rounded-md bg-[#28C840]" />
        <div className={cn('grow basis-0 text-center text-[13px]/4', muted)}>
          crudex · เดโม (ข้อมูลตัวอย่าง)
        </div>
      </div>
      <div className="flex min-h-0 grow">
        <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-[#E3EAF6] bg-[#F6F9FF] p-4 lg:flex">
          <BrandLogo size={20} className="mb-3" />
          <div
            className={cn(
              'mb-2 inline-flex w-fit rounded-full bg-[#2F6BFF] px-3 py-1 text-[13px]/4 font-bold text-white',
            )}
          >
            ม.2/1
          </div>
          {team.slice(0, 5).map((a, i) => (
            <div
              key={a.id}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-2.5 py-2',
                i === 0 && 'bg-white [box-shadow:#1522380D_0px_2px_10px]',
              )}
            >
              <Mascot id={a.id} size={32} />
              <div className="min-w-0">
                <div className={cn('truncate text-sm/4.5 font-bold', ink)}>
                  {a.name.split(' · ')[0]}
                </div>
                <div className={cn('truncate text-xs/4', muted)}>{a.short}</div>
              </div>
            </div>
          ))}
          <div className="mt-auto rounded-xl bg-[#FFF8D6] px-3 py-2 text-xs/4 text-[#8A6D00]">
            ข้อมูลในเดโมเป็นตัวอย่างทั้งหมด
          </div>
        </aside>
        <div className="flex min-w-0 grow flex-col">
          <div className="flex items-center gap-3 border-b border-[#E3EAF6] px-6 py-3">
            <Mascot id="jaew" size={36} />
            <div>
              <div className={cn('text-[15px]/4.5 font-bold', ink)}>น้องแจ๋ว · เลขาครู</div>
              <div className="text-xs/4 font-semibold text-[#18B87A]">● ม.2/1 · ว่าง คุยได้เลย</div>
            </div>
          </div>
          <ChatSample />
        </div>
      </div>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="relative z-[2] flex h-160 w-82.5 shrink-0 flex-col overflow-clip rounded-t-[30px] bg-white [box-shadow:#15223840_0px_16px_40px]">
      <div className={cn('px-6 pt-4 pb-2 text-sm/4.5 font-semibold', ink)}>9:41</div>
      <div className="flex items-center gap-3 border-b border-[#E3EAF6] px-4 pb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="#152238"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Mascot id="jaew" size={34} />
        <div>
          <div className={cn('text-[15px]/4.5 font-bold', ink)}>น้องแจ๋ว</div>
          <div className="text-xs/4 font-semibold text-[#18B87A]">● ม.2/1 · ว่าง คุยได้เลย</div>
        </div>
      </div>
      <ChatSample compact />
    </div>
  );
}

function Sky({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {mobile ? (
        <>
          <div
            data-parallax="0.18"
            className="absolute -right-12 -top-12 size-34 rounded-full bg-[#FFD43B] [box-shadow:#FFD43BB3_0px_0px_50px]"
          />
          <div
            data-parallax="0.26"
            className="absolute -left-8 top-40 h-14 w-40 rounded-[60px] bg-[#FFFFFFD9]"
          />
        </>
      ) : (
        <>
          <div
            data-parallax="0.22"
            className="absolute -left-10 top-95 h-22.5 w-65 rounded-[60px] bg-[#FFFFFFD9]"
          />
          <div
            data-parallax="0.3"
            className="absolute left-10 top-20 h-22.5 w-37.5 rounded-[60px] bg-[#FFFFFFD9]"
          />
          <div
            data-parallax="0.18"
            className="absolute -right-7.5 top-82.5 h-20 w-60 rounded-[50px] bg-[#FFFFFFBF]"
          />
          <div
            data-parallax="0.26"
            className="absolute right-22.5 -top-15 size-37.5 rounded-[75px] bg-[#FFD43B] [box-shadow:#FFD43BB3_0px_0px_60px]"
          />
        </>
      )}
      <div
        className={cn(
          'absolute z-[3] flex gap-2.5',
          mobile ? 'left-1/2 top-5 -translate-x-1/2' : 'left-75 top-5.5',
        )}
      >
        {(['jum', 'nun', 'porn'] as const).map((id) => (
          <Mascot key={id} id={id} size={mobile ? 36 : 44} />
        ))}
      </div>
    </>
  );
}

/* ---------- page ---------- */

export function LandingPage() {
  useEffect(() => initMotion(), []);
  return (
    <div className="flex flex-col items-center overflow-x-clip bg-white font-sans antialiased [font-synthesis:none]">
      {/* nav */}
      <header className="m-nav sticky top-0 z-20 flex h-16 w-full max-w-300 shrink-0 bg-white items-center gap-2.5 px-5 md:h-22 md:gap-7 md:px-6 xl:px-0">
        <div className="flex grow basis-0 items-center">
          <span className="flex md:hidden">
            <BrandLogo size={21} />
          </span>
          <span className="hidden md:flex">
            <BrandLogo size={27} />
          </span>
        </div>
        <nav className="hidden items-center gap-7 md:flex">
          <a href="#team" className={cn('text-[17px]/5.5 hover:underline', ink)}>
            ทีมบอท
          </a>
          <a href="#how" className={cn('text-[17px]/5.5 hover:underline', ink)}>
            วิธีใช้
          </a>
        </nav>
        <Cta to="/account" className="px-4 text-sm md:px-5 md:text-base">
          บัญชีโรงเรียน
        </Cta>
      </header>

      {/* hero */}
      <section className="m-hero flex w-full max-w-300 flex-col items-center gap-4.5 px-5 pt-9 pb-8 text-center md:gap-6.5 md:px-6 md:pt-18 md:pb-14">
        <div className="inline-flex items-center gap-2 rounded-full bg-[#F2F5FB] px-3 py-1.25 md:px-4 md:py-1.75">
          <span className={cn('text-[13px]/4 md:text-[15px]/4.5', body)}>
            สำหรับครูและผู้บริหารโรงเรียน
          </span>
          <span className="hidden text-[15px]/4.5 text-[#9AA7C2] md:inline">·</span>
          <span className={cn('hidden text-[15px]/4.5 font-semibold md:inline', ink)}>
            ใช้ผ่านเว็บ ไม่ต้องติดตั้ง
          </span>
        </div>
        <h1
          className={cn(
            'flex flex-col items-center gap-1 whitespace-nowrap font-bold tracking-[-0.04em] md:flex-row md:gap-5.5',
            'text-[52px]/14.5 md:text-7xl/20 lg:text-[96px]/26 xl:text-[104px]/28',
            ink,
          )}
        >
          <span className="flex items-center gap-2.5 md:gap-5.5">
            ครูสั่ง
            <Mascot id="jaew" size={50} className="md:hidden" />
            <Mascot id="jaew" size={96} className="hidden md:block" />
          </span>
          <span>ทีมบอททำ</span>
        </h1>
        <p className={cn('max-w-205 text-[17px]/6.75 md:text-[22px]/9', body)}>
          ทีมผู้ช่วย AI ของครู ทำใบงาน ฟอร์ม เกม และสไลด์ สรุปคะแนนห้อง และส่งเอกสารเบิกถึง ผอ.
          แค่พิมพ์บอกเหมือนแชตกับเพื่อนร่วมงาน
        </p>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <Cta className="py-3.75 text-lg/5.5 md:px-7.5 md:py-4 md:text-[19px]/6">ลองเดโมฟรี</Cta>
          <SoftButton href="#how" className="py-3.75 text-lg/5.5 md:px-7 md:py-4 md:text-[19px]/6">
            ดูวิธีใช้
          </SoftButton>
        </div>
        <p className={cn('text-[13px]/4 md:text-[15px]/4.5', muted)}>
          ไม่ต้องสมัคร · ข้อมูลในเดโมเป็นตัวอย่างทั้งหมด
        </p>
      </section>

      {/* product preview */}
      <div
        className="relative flex h-102.5 w-full shrink-0 justify-center overflow-clip pt-17.5 md:h-215 md:w-[min(1340px,calc(100%-40px))] md:rounded-[36px]"
        style={{
          backgroundImage:
            'linear-gradient(in oklab 180deg, #6FB6FF 0%, #A9D6FF 60%, #DDF0FF 100%)',
        }}
      >
        <div className="md:hidden" data-reveal="scale">
          <Sky mobile />
          <PhoneMock />
        </div>
        <div className="hidden w-full justify-center px-10 md:flex" data-reveal="scale">
          <Sky />
          <BrowserMock />
        </div>
      </div>

      {/* statement */}
      <section className="flex w-full max-w-280 flex-wrap items-center gap-x-3.5 gap-y-1.5 px-5 pt-14 pb-10 md:px-6 xl:px-0 md:pt-35 md:pb-30">
        <h2
          data-scrub-words
          className={cn('text-[32px]/10.5 font-bold tracking-[-0.03em] md:text-6xl/19', ink)}
        >
          <span className="w">พิมพ์บอกบอท</span>
          <span className="mx-3.5 hidden translate-y-1.5 gap-3.5 md:inline-flex">
            <Mascot id="jum" size={52} />
            <Mascot id="nun" size={52} />
          </span>
          <span className="w">ว่าอยากได้อะไร</span>
          <br className="hidden md:inline" /> <span className="w">มันทำงานให้เอง</span>{' '}
          <span className="w">จนเสร็จ</span>
          <span className="mx-3.5 hidden h-13 w-16 translate-y-2 items-center justify-center rounded-xl bg-[#E3ECFF] md:inline-flex">
            <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
              <rect
                x="3"
                y="4"
                width="18"
                height="12"
                rx="2"
                fill="none"
                stroke="#2F6BFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 20h8M12 16v4"
                fill="none"
                stroke="#2F6BFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <br className="hidden md:inline" />{' '}
          <span className="text-[#9AA7C2]">
            <span className="w">และจำได้ว่า</span> <span className="w">ครูชอบแบบไหน</span>
          </span>
          <span className="mx-3.5 hidden h-13 w-16 translate-y-2 items-center justify-center rounded-xl bg-[#FFF8D6] md:inline-flex">
            <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"
                fill="none"
                stroke="#C99A00"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 7h6M8 11h6"
                fill="none"
                stroke="#C99A00"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </h2>
      </section>

      {/* team */}
      <section
        id="team"
        className="mx-5 flex w-[calc(100%-40px)] max-w-300 scroll-mt-20 md:scroll-mt-24 justify-center rounded-[28px] p-3.5 md:rounded-[36px] md:p-16"
        style={{ backgroundImage: 'linear-gradient(in oklab 180deg, #A9D6FF 0%, #DDF0FF 100%)' }}
      >
        <div className="flex w-full flex-col gap-3 rounded-[22px] bg-white px-4.5 py-7 [box-shadow:#1522381A_0px_12px_40px] md:rounded-[28px] md:px-13 md:py-12">
          <h2
            className={cn(
              'text-[26px]/8.5 font-bold tracking-[-0.02em] md:text-5xl/14.5 md:tracking-[-0.03em]',
              ink,
            )}
          >
            บอท 1 ตัว งาน 1 อย่าง แชต 1 ห้อง
          </h2>
          <p className={cn('hidden pb-5 text-xl/6 md:block', body)}>
            เริ่มจากน้องแจ๋วตัวเดียว น้องแจ๋วจะแบ่งงานให้น้อง ๆ ในทีมเอง
          </p>
          <ul
            data-reveal-stagger
            className="mt-3 grid gap-5 md:mt-0 md:grid-cols-2 md:gap-x-10 md:gap-y-7"
          >
            {team.map((a) => (
              <li key={a.id} data-reveal="pop" className="m-lift flex gap-3 rounded-2xl md:gap-4">
                <Mascot id={a.id} size={36} className="md:hidden" />
                <Mascot id={a.id} size={44} className="hidden md:block" />
                <div className="flex flex-col gap-1">
                  <div className={cn('text-[17px]/5.5 font-bold md:text-[19px]/6', ink)}>
                    {a.name}
                  </div>
                  <div className={cn('text-[15px]/5.75 md:text-base/6.25', body)}>{a.role}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* how it works */}
      <section
        id="how"
        className="flex w-full max-w-300 scroll-mt-20 md:scroll-mt-24 flex-col gap-6 px-5 pt-16 pb-4 md:gap-10 md:px-6 xl:px-0 md:pt-30 md:pb-10"
      >
        <h2 className={cn('text-[32px]/10.5 font-bold tracking-[-0.03em] md:text-5xl/14.5', ink)}>
          สั่งในแชต ทีมทำต่อให้จนจบ
        </h2>
        <div data-reveal-stagger className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          <HowCard
            title="สรุปเช้าให้ ผอ."
            text="รุ่งเช้าสรุปภาพรวมโรงเรียนไม่เกิน 7 บรรทัด ระดับห้อง ไม่มีคะแนนรายคน"
          >
            <div className={cn('text-[13px]/4 font-bold', muted)}>สรุปเช้า · ตัวอย่าง</div>
            <div className={cn('text-[15px]/5.75', ink)}>
              ม.2/1 เฉลี่ย 58% · หัวข้อพีทาโกรัสในชีวิตจริงต่ำกว่าเกณฑ์
            </div>
            <div className={cn('text-[15px]/5.75', ink)}>เอกสารรออนุมัติ 1 รายการ</div>
          </HowCard>
          <HowCard
            title="จำได้ แก้ได้"
            text="น้องแจ๋วจดว่าครูชอบแบบไหน ห้องไหนเรียนถึงไหน ครูเปิดดูและแก้ได้ทุกข้อ"
          >
            <div className={cn('text-[13px]/4 font-bold', muted)}>น้องแจ๋วจำไว้ · ม.2/1</div>
            <MemoryRow text="ชอบใบงาน 4 ตัวเลือก" />
            <MemoryRow text="กำลังเรียนพีทาโกรัส" />
          </HowCard>
          <HowCard
            title="ถามก่อนทำเรื่องสำคัญ"
            text="ก่อนจำเรื่องใหม่ น้องแจ๋วถามครูก่อน เอกสารเบิกของป้าพรต้องให้ ผอ. อนุมัติทุกครั้ง"
          >
            <div className="flex items-center gap-2.5">
              <Mascot id="porn" size={30} />
              <div className={cn('text-[15px]/4.5', ink)}>
                เบิกอุปกรณ์คณิตศาสตร์ ส่งให้ ผอ. อนุมัติไหมคะ?
              </div>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-[#2F6BFF] px-4 py-1.5 text-sm/4.5 font-bold text-white">
                ส่งเลย
              </span>
              <span
                className={cn(
                  'rounded-full border-[1.5px] border-[#DCE4F2] px-3.5 py-1.25 text-sm/4.5',
                  body,
                )}
              >
                ดูก่อน
              </span>
            </div>
          </HowCard>
        </div>
      </section>

      {/* closing CTA */}
      <section
        data-reveal="scale"
        className="flex w-full max-w-300 flex-col items-center gap-4.5 px-5 pt-16 pb-12 text-center md:gap-6 md:px-6 xl:px-0 md:pt-30 md:pb-25"
      >
        <div className="hidden gap-2.5 md:flex">
          {(['jaew', 'jum', 'jeng', 'porn', 'nun'] as const).map((id) => (
            <Mascot key={id} id={id} size={56} />
          ))}
        </div>
        <h2
          className={cn(
            'text-4xl/11 font-bold tracking-[-0.03em] md:text-7xl/21 md:tracking-[-0.04em]',
            ink,
          )}
        >
          พบทีมของครูได้ใน 2 นาที
        </h2>
        <p className={cn('hidden text-xl/6 md:block', body)}>
          ลองเดโมด้วยข้อมูลตัวอย่าง ไม่ต้องสมัคร ไม่ต้องติดตั้ง
        </p>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <Cta className="py-3.75 text-lg/5.5 md:px-7.5 md:py-4 md:text-[19px]/6">ลองเดโมฟรี</Cta>
          <Cta
            to="/account"
            tone="yellow"
            className="py-3.75 text-lg/5.5 md:px-7 md:py-4 md:text-[19px]/6"
          >
            เข้าบัญชีโรงเรียน
          </Cta>
        </div>
      </section>

      {/* footer */}
      <footer className="flex w-[calc(100%-40px)] max-w-300 flex-col items-start gap-3 md:flex-row md:items-center md:gap-5 border-t border-[#E3EAF6] pt-6 pb-10 md:pt-8 md:pb-12">
        <BrandLogo size={22} />
        <p className={cn('grow basis-0 text-[13px]/5 md:text-sm/5', muted)}>
          ทีมผู้ช่วย AI ของครู · ชื่อ ตัวเลข และแชตในหน้านี้เป็นตัวอย่างทั้งหมด
        </p>
      </footer>
    </div>
  );
}

function HowCard({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div
      data-reveal
      className="m-lift flex grow basis-0 flex-col gap-4 rounded-[28px] bg-[#F6F9FF] p-6 md:p-7"
    >
      <h3 className={cn('text-[22px]/7 font-bold', ink)}>{title}</h3>
      <p className={cn('text-base/6.25', body)}>{text}</p>
      <div className="mt-auto flex flex-col gap-2.5 rounded-2xl bg-white p-3.5 [box-shadow:#1522380D_0px_2px_10px]">
        {children}
      </div>
    </div>
  );
}

function MemoryRow({ text }: { text: string }) {
  return (
    <div className="flex justify-between">
      <span className={cn('text-[15px]/4.5', ink)}>{text}</span>
      <span className="text-[13px]/4 font-bold text-[#2F6BFF]">แก้</span>
    </div>
  );
}
