'use client';

import React from 'react';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Pixel-stepped web corner — blue/cream, matches Spidey Tracker HUD. */
export default function PixelWebCorner({ position, size = 60 }: { position: Position; size?: number }) {
  let transform = '';
  switch (position) {
    case 'top-right':
      transform = 'scaleX(-1)';
      break;
    case 'bottom-left':
      transform = 'scaleY(-1)';
      break;
    case 'bottom-right':
      transform = 'scale(-1, -1)';
      break;
    default:
      transform = 'none';
      break;
  }

  const steps: number[] = [];
  for (let r = 12; r <= size; r += 12) steps.push(r);

  const strokeMain = '#4aa8e8';
  const strokeDim = 'rgba(170,210,255,0.45)';

  return (
    <div
      style={{
        width: size,
        height: size,
        transform,
        overflow: 'hidden',
        imageRendering: 'pixelated',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ imageRendering: 'pixelated' } as React.CSSProperties}
      >
        {/* Anchor strands */}
        <line x1="0" y1="0" x2="0" y2={size} stroke={strokeMain} strokeWidth="3" />
        <line x1="0" y1="0" x2={size} y2={size} stroke={strokeMain} strokeWidth="3" />
        <line x1="0" y1="0" x2={size} y2="0" stroke={strokeMain} strokeWidth="3" />
        <line x1="0" y1="0" x2={size * 0.45} y2={size * 0.88} stroke={strokeDim} strokeWidth="2" />
        <line x1="0" y1="0" x2={size * 0.88} y2={size * 0.45} stroke={strokeDim} strokeWidth="2" />

        {/* Stepped rectangular web bands */}
        {steps.map((r, i) => (
          <polyline
            key={i}
            points={`0,${r} ${Math.round(r * 0.35)},${Math.round(r * 0.92)} ${r},${r} ${Math.round(r * 0.92)},${Math.round(r * 0.35)} ${r},0`}
            fill="none"
            stroke={i % 2 === 0 ? strokeMain : strokeDim}
            strokeWidth="2"
          />
        ))}

        {/* Corner knot */}
        <rect x="0" y="0" width="6" height="6" fill="#f0dfa8" stroke="#000" strokeWidth="1" />
        <rect x="2" y="2" width="2" height="2" fill="#df2a2f" />
      </svg>
    </div>
  );
}
