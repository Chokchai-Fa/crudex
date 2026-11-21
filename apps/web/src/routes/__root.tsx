import '../features/school/school-flow.css';
import { createRootRoute, Link, redirect, Outlet, useRouterState } from '@tanstack/react-router';

import { useEffect } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';

export const Route = createRootRoute({
  beforeLoad: ({ location }) => {
    const path = location.pathname.toLowerCase().replace(/\/+$/, '');
    if (
      ['/gradebook', '/principal', '/reports', '/memory', '/notes'].includes(path) ||
      path.startsWith('/student/')
    )
      throw redirect({ to: '/school', replace: true });
  },
  component: RootLayout,
  notFoundComponent: () => (
    <AppShell>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">ไม่พบหน้านี้</h1>
        <p className="text-muted-foreground">ตรวจสอบลิงก์หรือกลับหน้าแรก</p>
        <Button asChild>
          <Link to="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </AppShell>
  ),
  errorComponent: ({ reset }) => (
    <AppShell>
      <div role="alert" className="flex flex-col items-center gap-2 py-16 text-center">
        <h1 className="text-2xl font-semibold">เปิดหน้านี้ไม่สำเร็จ</h1>
        <p className="text-muted-foreground break-words">กรุณาลองเปิดหน้านี้อีกครั้ง</p>
        <Button onClick={reset}>ลองอีกครั้ง</Button>
        <Button asChild variant="link">
          <Link to="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

const pageTitles: Record<string, string> = {
  '/': 'ทีมผู้ช่วย AI ของครู',
  '/school': 'พื้นที่โรงเรียน',
  '/teacher': 'แชตครู',
  '/account': 'บัญชีโรงเรียน',
  '/admin': 'จัดการโรงเรียน',
};

function RootLayout() {
  const path =
    useRouterState({ select: (state) => state.location.pathname })
      .replace(/\/+$/, '')
      .toLowerCase() || '/';
  const quiz = path.startsWith('/play/');
  const accountPage = path === '/admin' || path === '/account';
  useEffect(() => {
    document.title =
      (quiz ? 'แบบฝึกของห้องเรียน' : (pageTitles[path] ?? 'ไม่พบหน้านี้')) + ' · crudex';
  }, [path, quiz]);
  return path === '/school' || accountPage || quiz ? (
    <AppShell>
      {accountPage && (
        <nav
          aria-label="เมนูหลัก"
          className={
            'mx-auto mb-5 flex w-full items-center justify-between ' +
            (path === '/account' ? 'max-w-xl' : '')
          }
        >
          <Link
            to="/"
            className="inline-flex min-h-11 items-center"
            aria-label="crudex · กลับหน้าแรก"
          >
            <BrandLogo size={26} />
          </Link>
          {path === '/admin' && (
            <Button asChild variant="link">
              <Link to="/account">บัญชีโรงเรียน</Link>
            </Button>
          )}
        </nav>
      )}
      <Outlet />
    </AppShell>
  ) : (
    <Outlet />
  );
}
