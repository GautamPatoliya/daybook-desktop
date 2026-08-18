'use client';

import React from 'react';
import type { PixelCell } from './spiderPixelArt';

type Props = {
  pixels: PixelCell[];
  viewSize?: number;
  displaySize?: number;
  className?: string;
};

export default function PixelSprite({
  pixels,
  viewSize = 48,
  displaySize = 128,
  className,
}: Props) {
  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      width={displaySize}
      height={displaySize}
      className={className}
      shapeRendering="crispEdges"
      style={{ imageRendering: 'pixelated', display: 'block' } as React.CSSProperties}
      aria-hidden="true"
    >
      {pixels.map((p, i) => (
        <rect
          key={i}
          x={p.x}
          y={p.y}
          width={p.w ?? 1}
          height={p.h ?? 1}
          fill={p.fill}
        />
      ))}
    </svg>
  );
}
