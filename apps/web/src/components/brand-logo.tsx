import type { SVGProps } from 'react';

type BrandLogoProps = SVGProps<SVGSVGElement> & { alt: string };

export function BrandLogo({ alt, ...props }: BrandLogoProps) {
  // The artwork contains both pieces. Center their visible bounds on y=32.
  return (
    <svg
      viewBox="0 0 292 64"
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={!alt || undefined}
      {...props}
    >
      <rect width="292" height="64" rx="6" fill="#f6f9fe" />
      <svg x="0" y="0.5" width="68" height="63" viewBox="0 0 68 63">
        <image href="/roles/brand.png" width="292" height="64" />
      </svg>
      <svg x="68" width="224" height="64" viewBox="68 3 224 64">
        <image href="/roles/brand.png" width="292" height="64" />
      </svg>
    </svg>
  );
}
