'use client';

type Props = {
  /** Display size in CSS pixels. */
  size?: number;
  className?: string;
};

/**
 * Daybook notebook mark from `npm run icons:generate`
 * → `renderer/public/brand/logo.png`
 */
export function BrandMark({ size = 28, className }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export; unoptimized brand asset
    <img
      src="/brand/logo.png"
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={className ? `brand-logo ${className}` : 'brand-logo'}
      draggable={false}
      decoding="async"
    />
  );
}

export default BrandMark;
