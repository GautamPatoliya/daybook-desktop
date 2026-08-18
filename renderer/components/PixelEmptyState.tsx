'use client';
import React from 'react';

type PixelData = Array<{ x: number; y: number; fill: string; cls?: string }>;

// ────────────────────────────────────────────────────────────
// BACKLOG: Rooftop with crates, antenna, hanging web strand
// ────────────────────────────────────────────────────────────
const BACKLOG: PixelData = [];
(function buildBacklog() {
  // Background sky rows
  for (let x = 0; x < 48; x++) {
    BACKLOG.push({ x, y: 0, fill: '#01020a' });
    BACKLOG.push({ x, y: 1, fill: '#010310' });
    BACKLOG.push({ x, y: 2, fill: '#010414' });
  }
  // Stars
  [3,9,15,22,30,38,44,7,19,35,41].forEach((sx, i) =>
    BACKLOG.push({ x: sx, y: i < 5 ? 0 : 1, fill: '#c0d0ff', cls: i % 3 === 0 ? 'sv-blink' : undefined })
  );
  // Distant city silhouette
  for (let bi = 0; bi < 7; bi++) {
    const bx = bi * 7;
    const bh = 5 + (bi % 4);
    for (let by = 0; by < bh; by++) {
      for (let bw = 0; bw < 5; bw++) {
        BACKLOG.push({ x: bx + bw, y: 25 - by, fill: bi % 2 === 0 ? '#0a0f22' : '#080c1a' });
      }
    }
  }
  // Building windows
  [1, 8, 15, 22, 29, 36].forEach((wx, i) =>
    BACKLOG.push({ x: wx, y: 23 - (i % 2), fill: '#ffd070', cls: i % 4 === 0 ? 'sv-blink' : undefined })
  );
  // Web strand from top-center
  for (let y = 4; y <= 22; y++) {
    const alpha = Math.max(0.2, 0.9 - (y - 4) * 0.035);
    BACKLOG.push({ x: 24, y, fill: `rgba(223,42,47,${alpha.toFixed(2)})` });
  }
  // Web anchor
  [22, 23, 24, 25, 26].forEach(x =>
    BACKLOG.push({ x, y: 4, fill: x === 24 ? '#df2a2f' : 'rgba(223,42,47,0.5)' })
  );
  // Web spread at bottom of strand
  for (let dx = -4; dx <= 4; dx++) {
    const alpha = Math.max(0.1, 0.8 - Math.abs(dx) * 0.15);
    BACKLOG.push({ x: 24 + dx, y: 22, fill: `rgba(223,42,47,${alpha.toFixed(2)})` });
    if (Math.abs(dx) <= 3) BACKLOG.push({ x: 24 + dx, y: 23, fill: `rgba(223,42,47,${(alpha * 0.6).toFixed(2)})` });
  }
  // Rooftop surface
  for (let x = 0; x < 48; x++) {
    BACKLOG.push({ x, y: 29, fill: '#1a2444' });
    BACKLOG.push({ x, y: 30, fill: '#10193a' });
    BACKLOG.push({ x, y: 31, fill: '#0c1430' });
  }
  // Left crate
  for (let cy = 26; cy <= 29; cy++) {
    for (let cx = 7; cx <= 12; cx++) {
      BACKLOG.push({ x: cx, y: cy, fill: cy === 26 ? '#252f55' : '#1e2a4a' });
    }
  }
  BACKLOG.push({ x: 10, y: 26, fill: '#303a60' });
  // Right crate
  for (let cy = 25; cy <= 29; cy++) {
    for (let cx = 34; cx <= 40; cx++) {
      BACKLOG.push({ x: cx, y: cy, fill: cy === 25 ? '#20304e' : '#18243e' });
    }
  }
  // Antenna on right
  for (let ay = 20; ay <= 25; ay++) {
    BACKLOG.push({ x: 37, y: ay, fill: ay <= 21 ? '#df2a2f' : '#8a1020' });
  }
  [35, 36, 38, 39].forEach(x => BACKLOG.push({ x, y: 21, fill: 'rgba(223,42,47,0.6)' }));
})();

// ────────────────────────────────────────────────────────────
// WIP: Spider-sense radial energy burst
// ────────────────────────────────────────────────────────────
const WIP: PixelData = [];
(function buildWIP() {
  const cx = 24, cy = 22;
  // Background
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) WIP.push({ x, y, fill: '#01020a' });
  }
  // Stars
  [2, 6, 44, 40, 14, 38].forEach((x, i) =>
    WIP.push({ x, y: i % 4, fill: '#c0d0ff', cls: 'sv-blink' })
  );
  // 8 radial rays
  const dirs: [number, number][] = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  const rayColors = ['#df2a2f','#d4a017','#1a7fc4','#df2a2f','#d4a017','#1a7fc4','#df2a2f','#d4a017'];
  dirs.forEach(([dx, dy], di) => {
    for (let d = 2; d <= 20; d++) {
      const alpha = Math.max(0, (1 - d / 22));
      if (alpha < 0.04) continue;
      const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
      WIP.push({ x: cx + dx * d, y: cy + dy * d, fill: rayColors[di] + a });
    }
  });
  // In-between diagonal rays (fainter)
  [[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2],[1,2],[2,1]].forEach(([dx, dy]) => {
    for (let d = 2; d <= 13; d++) {
      WIP.push({ x: cx + dx * d, y: cy + dy * d, fill: `rgba(212,160,23,${Math.max(0,0.5-d*0.035).toFixed(2)})` });
    }
  });
  // Concentric rectangular rings
  [5, 10, 15, 19].forEach((r, ri) => {
    const alpha = (0.65 - ri * 0.13).toFixed(2);
    for (let i = -r; i <= r; i++) {
      WIP.push({ x: cx + i, y: cy - r, fill: `rgba(223,42,47,${alpha})` });
      WIP.push({ x: cx + i, y: cy + r, fill: `rgba(223,42,47,${alpha})` });
      WIP.push({ x: cx - r, y: cy + i, fill: `rgba(223,42,47,${alpha})` });
      WIP.push({ x: cx + r, y: cy + i, fill: `rgba(223,42,47,${alpha})` });
    }
  });
  // Center orb
  [[cx,cy],[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]].forEach(([x,y]) =>
    WIP.push({ x, y, fill: '#df2a2f' })
  );
  [[cx+1,cy+1],[cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1]].forEach(([x,y]) =>
    WIP.push({ x, y, fill: '#ff6666' })
  );
  WIP.push({ x: cx, y: cy, fill: '#ffffff' });
})();

// ────────────────────────────────────────────────────────────
// DONE: Victory web with pixel checkmark
// ────────────────────────────────────────────────────────────
const DONE: PixelData = [];
(function buildDone() {
  const cx = 24, cy = 22;
  // Background
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 48; x++) DONE.push({ x, y, fill: '#01020a' });
  }
  // Stars
  [3,7,42,38,20,45].forEach((x, i) =>
    DONE.push({ x, y: i % 5, fill: '#c0d0ff' })
  );
  // Web rings (concentric rectangular)
  [3, 6, 9, 12, 16, 20].forEach((r, ri) => {
    const even = ri % 2 === 0;
    const alpha = even ? (0.7 - ri * 0.09).toFixed(2) : (0.38 - ri * 0.05).toFixed(2);
    for (let i = -r; i <= r; i++) {
      DONE.push({ x: cx + i, y: cy - r, fill: `rgba(26,127,196,${alpha})` });
      DONE.push({ x: cx + i, y: cy + r, fill: `rgba(26,127,196,${alpha})` });
      DONE.push({ x: cx - r, y: cy + i, fill: `rgba(26,127,196,${alpha})` });
      DONE.push({ x: cx + r, y: cy + i, fill: `rgba(26,127,196,${alpha})` });
    }
  });
  // Web spokes (4-direction)
  for (let d = 1; d <= 21; d++) {
    const a = Math.max(0, 0.4 - d * 0.016).toFixed(2);
    DONE.push({ x: cx + d, y: cy, fill: `rgba(26,127,196,${a})` });
    DONE.push({ x: cx - d, y: cy, fill: `rgba(26,127,196,${a})` });
    DONE.push({ x: cx, y: cy + d, fill: `rgba(26,127,196,${a})` });
    DONE.push({ x: cx, y: cy - d, fill: `rgba(26,127,196,${a})` });
    DONE.push({ x: cx + d, y: cy + d, fill: `rgba(26,127,196,${(parseFloat(a)*0.85).toFixed(2)})` });
    DONE.push({ x: cx - d, y: cy - d, fill: `rgba(26,127,196,${(parseFloat(a)*0.85).toFixed(2)})` });
    DONE.push({ x: cx + d, y: cy - d, fill: `rgba(26,127,196,${(parseFloat(a)*0.85).toFixed(2)})` });
    DONE.push({ x: cx - d, y: cy + d, fill: `rgba(26,127,196,${(parseFloat(a)*0.85).toFixed(2)})` });
  }
  // Pixel checkmark — bold 2px strokes
  const check: [number, number][] = [
    [cx-5,cy+2],[cx-4,cy+3],[cx-3,cy+4],[cx-2,cy+5],[cx-1,cy+4],
    [cx,cy+3],[cx+1,cy+2],[cx+2,cy+1],[cx+3,cy],[cx+4,cy-1],[cx+5,cy-2],
  ];
  check.forEach(([x, y]) => {
    DONE.push({ x, y, fill: '#1a7fc4' });
    DONE.push({ x, y: y + 1, fill: 'rgba(26,127,196,0.6)' });
  });
  // Checkmark highlights
  DONE.push({ x: cx - 5, y: cy + 2, fill: '#6ac4f0' });
  DONE.push({ x: cx + 5, y: cy - 2, fill: '#6ac4f0' });
  // Red center accent
  [[cx-2,cy+4],[cx-1,cy+4],[cx,cy+3]].forEach(([x,y]) =>
    DONE.push({ x, y, fill: '#df2a2f' })
  );
})();

const SCENES: Record<string, PixelData> = { none: BACKLOG, wip: WIP, done: DONE };
const LABELS: Record<string, string> = {
  none: 'THWIP IT HERE',
  wip: 'SPINNING...',
  done: 'SECURED!',
};
const ANIMS: Record<string, string> = {
  none: 'sv-empty-sway',
  wip: 'sv-empty-pulse',
  done: '',
};

interface Props { status: 'none' | 'wip' | 'done' }

export default function PixelEmptyState({ status }: Props) {
  const scene = SCENES[status] ?? BACKLOG;

  return (
    <div className="sv-empty-state">
      <svg
        viewBox="0 0 48 48"
        width={120}
        height={120}
        style={{ imageRendering: 'pixelated' } as React.CSSProperties}
        className={ANIMS[status] || undefined}
        aria-hidden="true"
      >
        {scene.map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width={1}
            height={1}
            fill={p.fill}
            className={p.cls}
          />
        ))}
      </svg>
      <p className="sv-empty-label">{LABELS[status]}</p>
    </div>
  );
}
