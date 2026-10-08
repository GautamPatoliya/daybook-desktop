'use client';

type Props = {
  /** Display size in CSS pixels. */
  size?: number;
  className?: string;
};

/**
 * Daybook notebook mark from `npm run icons:generate`
 * → `renderer/public/brand/logo.png` (256, from a 512 cutout)
 *
 * Always load the 256 asset so ~36–88px UI stays sharp on Retina.
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
