import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';

export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <span className={cn('relative inline-grid max-w-full min-w-0', className)}>
      <select
        className="min-h-11 w-full min-w-0 appearance-none rounded-xl border bg-background ps-3 pe-10 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current forced-colors:appearance-auto"
        {...props}
      />
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground forced-colors:hidden"
      />
    </span>
  );
}
