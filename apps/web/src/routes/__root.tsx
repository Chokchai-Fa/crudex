import '../features/school/school-flow.css';
import { createRootRoute, Link, redirect, Outlet, useRouterState } from '@tanstack/react-router';

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
  errorComponent: ({ error }) => (
    <AppShell>
      <div role="alert" className="flex flex-col items-center gap-2 py-16 text-center">
        <h1 className="text-2xl font-semibold">เปิดหน้านี้ไม่สำเร็จ</h1>
        <p className="text-muted-foreground break-words">
          {error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง'}
        </p>
        <Button asChild>
          <Link to="/">กลับหน้าแรก</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

function RootLayout() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return path === '/school' || path.startsWith('/play/') ? (
    <AppShell>
      <Outlet />
    </AppShell>
  ) : (
    <Outlet />
  );
}
