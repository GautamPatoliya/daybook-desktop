'use client';

import React, { useEffect, useState, useMemo } from 'react';
import PixelWebCorner from './PixelWebCorner';

/** Deterministic pseudo-random in [0, 1) — stable across renders */
function hash01(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 24 }, (_, i) => ({
  x: `${hash01(i + 1) * 100}%`,
  y: `${hash01(i + 41) * 48}%`,
}));

const BUILDINGS_BG = Array.from({ length: 20 }, (_, i) => {
  const width = 30 + hash01(i + 100) * 60;
  const height = 100 + hash01(i + 200) * 200;
  const x = i * (1200 / 20) - 20 + hash01(i + 300) * 40;
  return { x, y: 400 - height, width, height };
});

const BUILDINGS_FG = Array.from({ length: 16 }, (_, i) => {
  const width = 40 + hash01(i + 400) * 80;
  const height = 50 + hash01(i + 500) * 250;
  const x = i * (1200 / 16) - 10;
  const colors = ['#0a0e1a', '#0c1020', '#070b15'];
  const color = colors[Math.floor(hash01(i + 600) * colors.length)];
  return { x, y: 400 - height, width, height, color };
});

const WINDOWS = Array.from({ length: 36 }, (_, i) => ({
  x: hash01(i + 700) * 1200,
  y: 150 + hash01(i + 800) * 250,
  fill: hash01(i + 900) > 0.5 ? '#FF8C00' : '#FFD700',
  opacity: 0.3 + hash01(i + 1000) * 0.5,
}));

export default function SpiderVerseBackground() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsActive(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const skyline = useMemo(
    () => (
      <svg
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '280px',
          opacity: 0.35,
        }}
        aria-hidden
      >
        {BUILDINGS_BG.map((b, i) => (
          <rect key={`bg-${i}`} x={b.x} y={b.y} width={b.width} height={b.height} fill="#060914" />
        ))}
        {BUILDINGS_FG.map((b, i) => (
          <rect key={`fg-${i}`} x={b.x} y={b.y} width={b.width} height={b.height} fill={b.color} />
        ))}
        {WINDOWS.map((w, i) => (
          <rect key={`win-${i}`} x={w.x} y={w.y} width="4" height="4" fill={w.fill} opacity={w.opacity} />
        ))}
      </svg>
    ),
    []
  );

  if (!isActive) return null;

  return (
    <div
      className="sv-bg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#010208',
      }}
      aria-hidden
    >
      <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.45 }}>
        {STARS.map((s, i) => (
          <rect key={`star-${i}`} x={s.x} y={s.y} width="2" height="2" fill="#fff" />
        ))}
      </svg>

      <div style={{ position: 'absolute', top: 0, right: 0 }}>
        <PixelWebCorner position="top-right" size={150} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <PixelWebCorner position="bottom-left" size={120} />
      </div>

      {skyline}
    </div>
  );
}
