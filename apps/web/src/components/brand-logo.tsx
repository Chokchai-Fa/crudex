import { cn } from '@/lib/utils';

/** crudex mark + wordmark from Paper "Brand · โลโก้ crudex". Transparent, no background. */
export function BrandLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('brand-logo', className)} style={{ fontSize: Math.round(size * 1.1) }}>
      <svg width={size} height={size} viewBox="0 0 70 70" aria-hidden="true">
        <path
          d="M35 4c4 3 7 1 10 4s1 6 5 8 6 2 7 6-2 6 0 9 4 5 2 9-5 3-6 7-1 7-5 8-6-2-9 1-4 5-8 5-5-4-9-4-6 3-9 0-1-6-4-8-6-2-7-6 3-6 1-9-4-5-2-9 5-3 6-7 0-7 4-9 6 1 9-1 3-6 7-6 5 4 8 3z"
          fill="#2F6BFF"
        />
        <ellipse cx="27" cy="34" rx="7" ry="8.5" fill="#FFFFFF" />
        <ellipse cx="44" cy="34" rx="7" ry="8.5" fill="#FFFFFF" />
        <circle cx="28.5" cy="36" r="3.8" fill="#152238" />
        <circle cx="45.5" cy="36" r="3.8" fill="#152238" />
      </svg>
      <span>crudex</span>
    </span>
  );
}
