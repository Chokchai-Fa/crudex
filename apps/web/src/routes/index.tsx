import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/')({ component: RoleChooser });

const roles = [
  {
    name: 'ครู',
    path: '/teacher',
    image: 'jaew',
    description: 'คุยกับเลขาครู ทำสื่อ เก็บคะแนน ดูผลแยกตามห้องเรียน',
    scope: 'ครูตัวอย่าง · ป.5/1, ป.5/2, ป.6/1',
    action: 'เข้าใช้เป็นครู',
  },
  {
    name: 'ผู้อำนวยการ',
    path: '/principal',
    image: 'rungchao',
    description: 'รับสรุปเช้าจากน้องรุ่งเช้า เห็นภาพรวมระดับห้อง โดยไม่มีคะแนนรายคน',
    scope: 'ผอ. ตัวอย่าง · ทั้งโรงเรียน',
    action: 'เข้าใช้เป็น ผอ.',
  },
] as const;

function RoleChooser() {
  const [notice, setNotice] = useState('');
  function resetDemo() {
    if (!window.confirm('รีเซ็ตห้องที่เลือก ร่างคำสั่ง และใบงานตัวอย่างในแท็บนี้?')) return;
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith('crudex.demo.')) sessionStorage.removeItem(key);
    }
    setNotice('รีเซ็ตข้อมูลตัวอย่างในแท็บนี้แล้ว');
  }
  return (
    <main
      style={{ fontFamily: '"Noto Sans Thai", "Leelawadee UI", Thonburi, Tahoma, sans-serif' }}
      className="grid min-h-dvh place-items-center bg-[#f6f9fe] px-5 py-5 sm:py-10 text-[#15233b]"
    >
      <section className="w-full max-w-[700px]">
        <header className="mb-4 text-center sm:mb-7">
          <img
            src="/roles/brand.png"
            width="216"
            height="47"
            alt="Crudex"
            className="mx-auto mb-3 w-40 sm:mb-8 sm:w-[216px]"
          />
          <h1 className="text-3xl font-bold">เข้าใช้ในฐานะ</h1>
          <p className="mt-1 text-[#506183]">เดโมใช้บัญชีตัวอย่าง ไม่ต้องใส่รหัสผ่าน</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
          {roles.map((role) => (
            <article
              key={role.path}
              className={
                'flex flex-col rounded-[28px] border-2 bg-white p-4 sm:p-7 ' +
                (role.path === '/teacher'
                  ? 'border-[#326aff] shadow-lg shadow-blue-100'
                  : 'border-[#e1e9f6]')
              }
            >
              <img
                src={'/agents/' + role.image + '.svg'}
                alt=""
                className="w-12 sm:w-[72px]"
                width="72"
                height="72"
              />
              <h2 className="mt-1 text-2xl sm:mt-4 font-bold">{role.name}</h2>
              <p className="mt-1 grow sm:mt-3 leading-relaxed text-[#506183]">{role.description}</p>
              <p className="my-2 sm:mb-3 sm:mt-4 text-sm text-[#586c8e]">{role.scope}</p>
              <Link
                to={role.path}
                className={
                  'grid min-h-11 place-items-center rounded-full border-2 px-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-4 ' +
                  (role.path === '/teacher'
                    ? 'border-[#326aff] bg-[#326aff] text-white'
                    : 'border-[#dbe4f2]')
                }
              >
                {role.action}
              </Link>
            </article>
          ))}
        </div>
        <footer className="mt-5 flex flex-wrap items-center justify-center gap-x-4 text-center text-sm text-[#586c8e]">
          <span>ผู้ปกครองไม่ต้องเข้าเว็บ · เดโมใช้ข้อมูลตัวอย่าง</span>
          <button className="min-h-11 cursor-pointer font-bold text-[#235be2]" onClick={resetDemo}>
            รีเซ็ตข้อมูลตัวอย่าง
          </button>
        </footer>
        <p role="status" className="text-center text-sm">
          {notice}
        </p>
      </section>
    </main>
  );
}
