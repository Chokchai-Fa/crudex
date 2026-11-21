import { cn } from '@/lib/utils';

/** crudex mark + wordmark from Paper "Brand · โลโก้ crudex". Transparent, no background. */
export function BrandLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('brand-logo', className)} style={{ fontSize: Math.round(size * 1.1) }}>
      <img src="/favicon.svg" alt="" width={size} height={size} />
      <span>crudex</span>
    </span>
  );
}
