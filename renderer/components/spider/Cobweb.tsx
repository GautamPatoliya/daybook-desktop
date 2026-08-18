'use client';

import React from 'react';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** Classic cobweb drawn from a corner — spokes + silk rings. */
export default function Cobweb({
  size = 88,
  corner = 'top-left',
  opacity = 0.55,
}: {
  size?: number;
  corner?: Corner;
  opacity?: number;
}) {
  const transform =
    corner === 'top-right'
      ? 'scaleX(-1)'
      : corner === 'bottom-left'
        ? 'scaleY(-1)'
        : corner === 'bottom-right'
          ? 'scale(-1,-1)'
          : undefined;

  const spokes = [
    [0, size],
    [size * 0.18, size * 0.95],
    [size * 0.38, size * 0.88],
    [size * 0.58, size * 0.72],
    [size * 0.78, size * 0.5],
    [size * 0.92, size * 0.26],
    [size, 0],
  ];

  const rings = [0.22, 0.4, 0.62, 0.86];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      aria-hidden
      style={{
        display: 'block',
        transform,
        opacity,
        overflow: 'hidden',
      }}
    >
      {spokes.map(([x, y], i) => (
        <line
          key={`s${i}`}
          x1="0"
          y1="0"
          x2={x}
          y2={y}
          stroke="rgba(210,230,255,0.75)"
          strokeWidth={i === 0 || i === spokes.length - 1 ? 1.6 : 1.15}
        />
      ))}
      {rings.map((t, ri) => {
        const pts = spokes.map(([x, y]) => `${x * t},${y * t}`).join(' ');
        return (
          <polyline
            key={`r${ri}`}
            points={pts}
            stroke={ri % 2 ? 'rgba(160,200,240,0.45)' : 'rgba(220,235,255,0.7)'}
            strokeWidth="1.2"
            fill="none"
          />
        );
      })}
      <circle cx="1.5" cy="1.5" r="2.2" fill="#f0dfa8" stroke="#000" strokeWidth="0.8" />
    </svg>
  );
}
