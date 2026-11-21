import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-page px-4 py-5 sm:px-6 sm:py-10">
      <div className="m-page mx-auto max-w-6xl">{children}</div>
    </main>
  );
}
