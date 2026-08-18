'use client';

import React from 'react';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export default function PixelWebCorner({ position, size = 60 }: { position: Position; size?: number }) {
  let transform = '';
  switch (position) {
    case 'top-right': transform = 'scaleX(-1)'; break;
    case 'bottom-left': transform = 'scaleY(-1)'; break;
    case 'bottom-right': transform = 'scale(-1, -1)'; break;
    default: transform = 'none'; break;
  }

  const steps = [15, 30, 45];
  if (size > 60) {
    for (let i = 60; i < size; i += 15) steps.push(i);
  }

  return (
    <div style={{ width: size, height: size, transform, opacity: 0.4 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Radial lines */}
        <line x1="0" y1="0" x2="0" y2={size} stroke="#df2a2f" strokeWidth="2" />
        <line x1="0" y1="0" x2={size} y2={size} stroke="#df2a2f" strokeWidth="2" />
        <line x1="0" y1="0" x2={size} y2="0" stroke="#df2a2f" strokeWidth="2" />
        <line x1="0" y1="0" x2={size * 0.4} y2={size * 0.9} stroke="#df2a2f" strokeWidth="1" />
        <line x1="0" y1="0" x2={size * 0.9} y2={size * 0.4} stroke="#df2a2f" strokeWidth="1" />

        {/* Stepped rectangular bands */}
        {steps.map((r, i) => (
          <polyline
            key={i}
            points={`0,${r} ${r*0.4},${r*0.9} ${r},${r} ${r*0.9},${r*0.4} ${r},0`}
            fill="none"
            stroke="#df2a2f"
            strokeWidth="1"
          />
        ))}
      </svg>
    </div>
  );
}
