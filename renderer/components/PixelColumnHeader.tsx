'use client';
import React from 'react';

// ============================================================
// PIXEL COLUMN HEADERS
// ViewBox: 96 wide × 28 tall — each "pixel" = ~1 SVG unit
// Rendered at: full column width × 56px CSS height
// At a 320px wide column: each pixel ≈ 3.3px wide × 2px tall
// — large enough to clearly read as pixel art
// ============================================================

// ── Helper ──────────────────────────────────────────────────
function rect(x: number, y: number, fill: string, w = 1, h = 1) {
  return { x, y, fill, w, h };
}

// ── BACKLOG: NYC Rooftop Silhouette ─────────────────────────
// Clear city buildings + web strand + antenna
function makeBacklog() {
  const px: Array<{ x: number; y: number; fill: string; w: number; h: number }> = [];

  // SKY — deep night
  px.push(rect(0, 0, '#010410', 96, 28));

  // STARS (clear, isolated)
  for (const [sx, sy] of [[6,2],[18,1],[32,3],[52,2],[70,1],[84,3],[12,4],[44,1],[78,2]]) {
    px.push(rect(sx, sy, '#c8dcff', 2, 2));
  }

  // DISTANT CITY LAYER (lighter, thinner buildings at back)
  // Bldg BG-1
  px.push(rect(2,  16, '#0a142a', 8, 12));
  px.push(rect(2,  14, '#0a142a', 4, 2)); // tower top
  // Bldg BG-2
  px.push(rect(14, 18, '#08101e', 6, 10));
  px.push(rect(16, 16, '#08101e', 2, 2));
  // Bldg BG-3
  px.push(rect(38, 17, '#0a142a', 7, 11));
  // Bldg BG-4
  px.push(rect(60, 15, '#09111f', 9, 13));
  px.push(rect(63, 13, '#09111f', 3, 2));
  // Bldg BG-5
  px.push(rect(80, 19, '#0a142a', 6, 9));
  // Bldg BG-6
  px.push(rect(88, 16, '#08101e', 8, 12));

  // FOREGROUND BUILDINGS — darker, solid silhouettes
  // Bldg 1 — far left
  px.push(rect(0,  20, '#060c18', 11, 8));
  px.push(rect(2,  17, '#060c18', 7,  3));
  // Bldg 2 — left-center (TALLEST)
  px.push(rect(14, 12, '#050a14', 14, 16));
  px.push(rect(17, 10, '#050a14', 8,  2)); // setback
  px.push(rect(20,  8, '#050a14', 4,  2)); // spire base
  // Bldg 3 — center
  px.push(rect(32, 17, '#070d1c', 12, 11));
  px.push(rect(34, 15, '#070d1c', 8,  2));
  // Bldg 4 — right-center
  px.push(rect(48, 14, '#060b18', 16, 14));
  px.push(rect(50, 12, '#060b18', 12, 2));
  // Bldg 5 — far right
  px.push(rect(68, 19, '#050a14', 12, 9));
  px.push(rect(70, 17, '#050a14', 8,  2));
  // Bldg 6 — right edge
  px.push(rect(82, 16, '#060c18', 14, 12));
  px.push(rect(86, 14, '#060c18', 6,  2));

  // ANTENNA on tallest building (bldg 2)
  px.push(rect(23,  5, '#df2a2f', 2, 3)); // red top
  px.push(rect(23,  8, '#8a1020', 2, 2)); // dark middle

  // WINDOWS — bright squares against dark buildings
  // Bldg 1 windows
  for (const [wx, wy] of [[2,21],[6,21],[2,24],[6,24]]) px.push(rect(wx, wy, '#f0c050', 2, 2));
  // Bldg 2 windows
  for (const [wx, wy] of [[15,13],[20,13],[15,17],[20,17],[15,21],[20,21]]) px.push(rect(wx, wy, '#ffd060', 2, 2));
  // Bldg 3 windows
  for (const [wx, wy] of [[33,18],[37,18],[33,22],[37,22]]) px.push(rect(wx, wy, '#ff9820', 2, 2));
  // Bldg 4 windows
  for (const [wx, wy] of [[50,15],[55,15],[60,15],[50,19],[55,19],[60,19],[50,23],[55,23]]) px.push(rect(wx, wy, '#ffd060', 2, 2));
  // Bldg 5 windows
  for (const [wx, wy] of [[70,20],[74,20],[70,24],[74,24]]) px.push(rect(wx, wy, '#ff9820', 2, 2));
  // Bldg 6 windows
  for (const [wx, wy] of [[84,17],[88,17],[84,21],[88,21]]) px.push(rect(wx, wy, '#ffd060', 2, 2));

  // WEB STRAND hanging from top-center
  for (let y = 0; y <= 10; y++) {
    const alpha = Math.max(0.2, 0.9 - y * 0.07);
    px.push(rect(47, y, `rgba(223,42,47,${alpha.toFixed(1)})`, 2, 1));
  }
  // Web spread
  px.push(rect(43, 10, 'rgba(223,42,47,0.4)', 2, 1));
  px.push(rect(45, 10, 'rgba(223,42,47,0.6)', 4, 1));
  px.push(rect(49, 10, 'rgba(223,42,47,0.6)', 2, 1));
  px.push(rect(51, 10, 'rgba(223,42,47,0.4)', 2, 1));

  // GROUND LINE
  px.push(rect(0, 27, '#1a2848', 96, 1));

  return px;
}

// ── WIP: Spider-Sense Energy Burst ──────────────────────────
function makeWIP() {
  const px: Array<{ x: number; y: number; fill: string; w: number; h: number }> = [];

  px.push(rect(0, 0, '#010410', 96, 28));

  const cx = 48, cy = 14;

  // 8 RADIAL RAYS — each clearly visible with 2px width
  const rays: Array<[number, number, string]> = [
    [0, -1, '#df2a2f'],   // up
    [1, -1, '#c8960e'],   // up-right
    [1,  0, '#df2a2f'],   // right
    [1,  1, '#c8960e'],   // down-right
    [0,  1, '#df2a2f'],   // down
    [-1, 1, '#c8960e'],   // down-left
    [-1, 0, '#df2a2f'],   // left
    [-1,-1, '#c8960e'],   // up-left
  ];
  rays.forEach(([dx, dy, col]) => {
    for (let d = 3; d <= 18; d++) {
      const alpha = Math.max(0.05, 1 - (d - 3) / 18);
      const hex = Math.round(alpha * 255).toString(16).padStart(2, '0');
      const x = Math.round(cx + dx * d);
      const y = Math.round(cy + dy * d);
      if (x >= 0 && x < 95 && y >= 0 && y < 27) {
        px.push(rect(x, y, col + hex, 2, 2));
      }
    }
  });

  // CONCENTRIC RECTANGULAR RINGS (stepped, pixel style)
  [[5,'rgba(223,42,47,0.6)'],[9,'rgba(200,150,14,0.5)'],[13,'rgba(223,42,47,0.35)']].forEach(([r, col]) => {
    const R = r as number;
    const C = col as string;
    for (let i = -R; i <= R; i += 2) {
      if (cx+i >= 0 && cx+i < 95) {
        px.push(rect(cx + i, cy - R, C, 2, 2));
        px.push(rect(cx + i, cy + R, C, 2, 2));
      }
      if (cy+i >= 0 && cy+i < 27) {
        px.push(rect(cx - R, cy + i, C, 2, 2));
        px.push(rect(cx + R, cy + i, C, 2, 2));
      }
    }
  });

  // CENTER FLASH — bright white core surrounded by red
  px.push(rect(cx-2, cy-2, '#df2a2f', 4, 4));
  px.push(rect(cx-1, cy-1, '#ffffff', 2, 2));

  // SPEED LINES at corners
  for (let i = 0; i < 6; i++) {
    px.push(rect(i * 4,     0,  'rgba(200,150,14,0.3)', 3, 1));
    px.push(rect(94 - i*4,  0,  'rgba(223,42,47,0.3)',  3, 1));
    px.push(rect(i * 4,     27, 'rgba(200,150,14,0.3)', 3, 1));
    px.push(rect(94 - i*4,  27, 'rgba(223,42,47,0.3)',  3, 1));
  }

  return px;
}

// ── DONE: Secured Web ───────────────────────────────────────
function makeDone() {
  const px: Array<{ x: number; y: number; fill: string; w: number; h: number }> = [];

  px.push(rect(0, 0, '#010410', 96, 28));

  const cx = 48, cy = 14;

  // WEB RINGS — clear concentric rectangles in blue
  [[6,'rgba(22,112,176,0.75)'],[11,'rgba(22,112,176,0.55)'],[16,'rgba(22,112,176,0.35)']].forEach(([r, col]) => {
    const R = r as number; const C = col as string;
    for (let i = -R; i <= R; i += 2) {
      if (cx+i >= 0 && cx+i < 95) {
        px.push(rect(cx + i, cy - R, C, 2, 2));
        px.push(rect(cx + i, cy + R, C, 2, 2));
      }
      if (cy+i >= 0 && cy+i < 27) {
        px.push(rect(cx - R, cy + i, C, 2, 2));
        px.push(rect(cx + R, cy + i, C, 2, 2));
      }
    }
  });

  // SPOKES (4-directional)
  for (let d = 1; d <= 17; d += 2) {
    const a = Math.max(0.1, 0.5 - d * 0.025);
    const col = `rgba(22,112,176,${a.toFixed(2)})`;
    if (cx + d < 96) px.push(rect(cx + d, cy, col, 2, 2));
    if (cx - d >= 0) px.push(rect(cx - d, cy, col, 2, 2));
    if (cy + d < 28) px.push(rect(cx,     cy + d, col, 2, 2));
    if (cy - d >= 0) px.push(rect(cx,     cy - d, col, 2, 2));
  }

  // PIXEL CHECKMARK — bold 3px strokes, clearly visible
  const check: Array<[number, number]> = [
    [38,15],[39,16],[40,17],[41,18],[42,19],[43,20],
    [44,19],[45,18],[46,17],[47,16],[48,15],[49,14],
    [50,13],[51,12],[52,11],[53,10],[54,9],
  ];
  check.forEach(([x, y]) => {
    px.push(rect(x,   y,   '#1670b0', 3, 3));
    px.push(rect(x,   y,   '#4aa8e0', 2, 1)); // highlight top edge
  });

  // CENTER DOT
  px.push(rect(cx-2, cy-2, '#df2a2f', 4, 4));

  // CORNER STARS
  for (const [sx, sy] of [[3,2],[90,2],[3,24],[90,24],[20,2],[74,2]]) {
    px.push(rect(sx, sy, '#c8dcff', 2, 2));
  }

  return px;
}

const SCENES = {
  none: makeBacklog(),
  wip: makeWIP(),
  done: makeDone(),
} as const;

interface Props { status: 'none' | 'wip' | 'done' }

export default function PixelColumnHeader({ status }: Props) {
  const pixels = SCENES[status];
  return (
    <div className="pixel-col-header-art" aria-hidden="true">
      <svg
        viewBox="0 0 96 28"
        preserveAspectRatio="xMidYMid slice"
        style={{
          width: '100%',
          height: '56px',
          display: 'block',
          imageRendering: 'pixelated',
        } as React.CSSProperties}
      >
        {pixels.map((p, i) => (
          <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} fill={p.fill} />
        ))}
      </svg>
    </div>
  );
}
