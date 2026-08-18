'use client';
import React from 'react';

// 16x16 pixel spider art — each cell is one pixel
// 0=transparent, 1=body(red), 2=highlight(light), 3=shadow(dark), 4=eye(white), 5=web(light red)
const SPIDER_PIXELS: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,5,0,0,0,0,0,0,0,0,5,0,0,0],
  [0,0,5,0,0,0,1,1,1,1,0,0,0,5,0,0],
  [0,5,0,0,0,1,1,1,1,1,1,0,0,0,5,0],
  [5,0,0,0,1,1,2,1,1,2,1,1,0,0,0,5],
  [0,0,0,1,1,2,4,2,2,4,2,1,1,0,0,0],
  [0,0,3,1,1,1,2,1,1,2,1,1,1,3,0,0],
  [0,3,0,1,1,1,1,1,1,1,1,1,1,0,3,0],
  [0,3,0,0,1,1,1,1,1,1,1,1,0,0,3,0],
  [0,0,3,0,0,1,1,1,1,1,1,0,0,3,0,0],
  [0,0,0,3,0,1,1,1,1,1,1,0,3,0,0,0],
  [0,3,0,0,1,0,0,1,1,0,0,1,0,0,3,0],
  [3,0,0,1,0,0,0,1,1,0,0,0,1,0,0,3],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const COLORS: Record<number, string> = {
  0: 'transparent',
  1: '#df2a2f',
  2: '#ff6666',
  3: '#8a1010',
  4: '#f0f0ff',
  5: 'rgba(223,42,47,0.35)',
};

interface Props {
  size?: number;
  className?: string;
}

export default function SpiderLogoPixel({ size = 32, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ imageRendering: 'pixelated' }}
      className={className}
      aria-hidden="true"
    >
      {SPIDER_PIXELS.map((row, y) =>
        row.map((cell, x) =>
          cell !== 0 ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={1}
              height={1}
              fill={COLORS[cell]}
            />
          ) : null
        )
      )}
    </svg>
  );
}
