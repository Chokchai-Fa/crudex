import { createRootRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => (
    <AppShell>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">ไม่พบหน้านี้</h1>
        <p className="text-muted-foreground">ตรวจสอบลิงก์หรือกลับไปเลือกบทบาท</p>
        <Button asChild>
          <Link to="/">กลับไปเลือกบทบาท</Link>
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
          <Link to="/">กลับไปเลือกบทบาท</Link>
        </Button>
      </div>
    </AppShell>
  ),
});

function RootLayout() {
  const page = useRouterState({ select: (state) => state.matches.at(-1)?.routeId });
  if (page === '/' || page === '/teacher' || page === '/gradebook') return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
