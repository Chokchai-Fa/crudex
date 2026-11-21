import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/principal')({ component: PrincipalBrief });

function PrincipalBrief() {
  const [showAnswer, setShowAnswer] = useState(false);
  return (
    <section className="grid gap-5 rounded-3xl bg-[#f5f8ff] p-4 text-[#15233b] sm:p-6 lg:grid-cols-[10rem_minmax(0,1fr)_13rem]">
      <header className="space-y-2">
        <p className="text-sm text-[#506183]">ทั้งโรงเรียน</p>
        <h1 className="text-2xl font-bold">ผู้อำนวยการ</h1>
        <Link to="/" className="inline-flex min-h-11 items-center text-blue-700 underline">
          สลับบทบาท
        </Link>
      </header>
      <article className="min-w-0 space-y-5 rounded-2xl border border-blue-100 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
          <img src="/agents/rungchao.svg" alt="" width="56" height="56" />
          <div>
            <p className="text-sm text-amber-800">ข้อมูลตัวอย่าง</p>
            <h2 className="text-xl font-bold">น้องรุ่งเช้า</h2>
          </div>
        </div>
        <div>
          <p className="text-sm text-[#506183]">
            <time dateTime="2026-11-21T07:00:00+07:00">21 พ.ย. 2569 · 07:00 น.</time>
          </p>
          <h3 className="mt-1 text-2xl font-bold">สรุปเช้าสำหรับผู้บริหาร</h3>
        </div>
        <ol className="list-decimal space-y-4 ps-6 leading-relaxed marker:font-bold marker:text-blue-700">
          <li>
            <strong>ติดตามงาน ป.6/1</strong>
            <br />
            ยังขาดงานคณิตศาสตร์ 6 คน ครูประจำชั้นรับทราบแล้ว
          </li>
          <li>
            <strong>แบบฝึกเศษส่วน ป.5/2</strong>
            <br />
            ส่งแล้ว 18 จาก 20 คน เหลือติดตาม 2 คน
          </li>
          <li>
            <strong>สื่อการสอน</strong>
            <br />
            เมื่อวานครู 12 คนร่วมกันสร้างสื่อ 9 ชุด
          </li>
        </ol>
        <Button
          className="rounded-full bg-blue-700 text-white hover:bg-blue-800"
          aria-expanded={showAnswer}
          aria-controls="brief-answer"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          {showAnswer ? 'ซ่อนคำตอบ' : 'ห้องไหนควรช่วย?'}
        </Button>
        <div id="brief-answer" aria-live="polite">
          {showAnswer && (
            <p className="rounded-xl bg-amber-50 p-4">
              จากข้อมูลตัวอย่าง แนะนำให้ติดตาม ป.6/1 ก่อน
              โดยถามครูประจำชั้นว่านักเรียนที่ยังขาดงานทั้ง 6 คนต้องการความช่วยเหลือด้านใด
            </p>
          )}
        </div>
      </article>
      <aside className="self-start rounded-2xl border border-blue-100 bg-white p-5">
        <h2 className="font-bold">ภาพรวมการส่งงาน</h2>
        <p className="mt-3 text-sm">แบบฝึกเศษส่วน · ป.5/2</p>
        <p className="mt-1 text-3xl font-bold text-blue-700">90%</p>
        <p className="mt-1 text-sm">ส่งแล้ว 18 จาก 20 คน</p>
      </aside>
    </section>
  );
}
