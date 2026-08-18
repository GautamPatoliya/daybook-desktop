'use client';
import React, { useEffect, useState } from 'react';

// ============================================================
// PIXEL SKYLINE SCENE — full-viewport fixed background
// ViewBox: 320 wide × 90 tall (large pixels = visible buildings)
// Rendered at: 100vw × 65vh (bottom-anchored)
// Each SVG unit ≈ (windowWidth/320) CSS px — at 1280px wide ≈ 4px per pixel
// Buildings are 30–60 SVG units tall = clearly visible silhouettes
// ============================================================

// Building definitions: [x, y_top, width, height, shade_index, windows]
// shade_index 0=darkest, 3=slightly lighter (background)
const SHADES = ['#040810', '#060c18', '#070e1e', '#09121e'];
const BACKGROUND_SHADES = ['#060a16', '#080e1c', '#0a1220'];

interface BuildingDef {
  x: number; y: number; w: number; h: number;
  shade: number; isBg?: boolean;
  windows: Array<[number, number]>;
  antenna?: boolean;
}

// Hand-crafted buildings for a clear, recognizable NYC skyline
const BUILDINGS: BuildingDef[] = [
  // ── BACKGROUND LAYER (lighter, showing depth) ──
  { x: 5,   y: 50, w: 18, h: 40, shade: 0, isBg: true, windows: [[8,55],[12,55],[8,62],[12,62],[8,69],[12,69]] },
  { x: 28,  y: 44, w: 14, h: 46, shade: 1, isBg: true, windows: [[30,48],[35,48],[30,56],[35,56],[30,64],[35,64],[30,72],[35,72]] },
  { x: 48,  y: 55, w: 20, h: 35, shade: 2, isBg: true, windows: [[50,60],[56,60],[62,60],[50,68],[56,68],[62,68]] },
  { x: 88,  y: 52, w: 16, h: 38, shade: 0, isBg: true, windows: [[90,58],[96,58],[90,66],[96,66],[90,74],[96,74]] },
  { x: 130, y: 48, w: 22, h: 42, shade: 1, isBg: true, windows: [[133,53],[139,53],[145,53],[133,62],[139,62],[145,62],[133,71],[139,71]] },
  { x: 168, y: 56, w: 14, h: 34, shade: 2, isBg: true, windows: [[170,60],[176,60],[170,68],[176,68],[170,76],[176,76]] },
  { x: 200, y: 50, w: 18, h: 40, shade: 0, isBg: true, windows: [[202,55],[208,55],[214,55],[202,63],[208,63],[214,63],[202,71],[208,71]] },
  { x: 236, y: 44, w: 24, h: 46, shade: 1, isBg: true, windows: [[238,50],[244,50],[250,50],[238,58],[244,58],[250,58],[238,66],[244,66],[250,66]] },
  { x: 278, y: 52, w: 16, h: 38, shade: 2, isBg: true, windows: [[280,58],[286,58],[280,66],[286,66],[280,74],[286,74]] },
  { x: 302, y: 58, w: 18, h: 32, shade: 0, isBg: true, windows: [[304,62],[310,62],[316,62],[304,70],[310,70],[316,70]] },

  // ── FOREGROUND LAYER (darkest, clearest silhouettes) ──
  // Empire-State-style tall thin tower — LEFT
  { x: 0,   y: 30, w: 20, h: 60, shade: 0, windows: [[2,38],[8,38],[14,38],[2,46],[8,46],[14,46],[2,54],[8,54],[14,54],[2,62],[8,62],[14,62],[2,70],[8,70],[14,70]], antenna: true },
  { x: 4,   y: 25, w: 12, h: 5,  shade: 0, windows: [] }, // setback
  { x: 7,   y: 22, w: 6,  h: 3,  shade: 0, windows: [] }, // spire base

  // Chunky office block
  { x: 24,  y: 40, w: 28, h: 50, shade: 0, windows: [[26,45],[32,45],[38,45],[44,45],[26,53],[32,53],[38,53],[44,53],[26,61],[32,61],[38,61],[44,61],[26,69],[32,69],[38,69],[44,69],[26,77],[32,77],[38,77],[44,77]] },

  // Thin tall tower — center left
  { x: 58,  y: 20, w: 12, h: 70, shade: 0, windows: [[60,28],[64,28],[60,36],[64,36],[60,44],[64,44],[60,52],[64,52],[60,60],[64,60],[60,68],[64,68],[60,76],[64,76]], antenna: true },
  { x: 56,  y: 38, w: 16, h: 12, shade: 0, windows: [] },  // shoulder

  // Wide skyscraper — center
  { x: 78,  y: 35, w: 36, h: 55, shade: 0, windows: [[80,40],[86,40],[92,40],[98,40],[104,40],[80,48],[86,48],[92,48],[98,48],[104,48],[80,56],[86,56],[92,56],[98,56],[104,56],[80,64],[86,64],[92,64],[98,64],[104,64],[80,72],[86,72],[92,72],[98,72],[104,72]] },
  { x: 82,  y: 28, w: 28, h: 7, shade: 0, windows: [] },
  { x: 87,  y: 24, w: 18, h: 4, shade: 0, windows: [] },

  // Right cluster — medium building
  { x: 120, y: 42, w: 24, h: 48, shade: 0, windows: [[122,48],[128,48],[134,48],[140,48],[122,56],[128,56],[134,56],[140,56],[122,64],[128,64],[134,64],[140,64],[122,72],[128,72],[134,72],[140,72]] },

  // Stepped art-deco tower — right center
  { x: 150, y: 18, w: 14, h: 72, shade: 0, windows: [[152,26],[158,26],[152,34],[158,34],[152,42],[158,42],[152,50],[158,50],[152,58],[158,58],[152,66],[158,66],[152,74],[158,74]], antenna: true },
  { x: 148, y: 32, w: 18, h: 10, shade: 0, windows: [] },
  { x: 146, y: 46, w: 22, h: 10, shade: 0, windows: [] },

  // Right side blocks
  { x: 172, y: 38, w: 30, h: 52, shade: 0, windows: [[174,44],[180,44],[186,44],[192,44],[198,44],[174,52],[180,52],[186,52],[192,52],[198,52],[174,60],[180,60],[186,60],[192,60],[198,60],[174,68],[180,68],[186,68],[192,68],[198,68],[174,76],[180,76],[186,76],[192,76],[198,76]] },

  // Tall right tower
  { x: 208, y: 22, w: 16, h: 68, shade: 0, windows: [[210,30],[218,30],[210,38],[218,38],[210,46],[218,46],[210,54],[218,54],[210,62],[218,62],[210,70],[218,70],[210,78],[218,78]], antenna: true },
  { x: 206, y: 36, w: 20, h: 10, shade: 0, windows: [] },

  // Far right large building
  { x: 230, y: 30, w: 38, h: 60, shade: 0, windows: [[232,36],[238,36],[244,36],[250,36],[256,36],[262,36],[232,44],[238,44],[244,44],[250,44],[256,44],[262,44],[232,52],[238,52],[244,52],[250,52],[256,52],[262,52],[232,60],[238,60],[244,60],[250,60],[256,60],[262,60],[232,68],[238,68],[244,68],[250,68],[256,68],[262,68],[232,76],[238,76],[244,76],[250,76]] },

  // Right edge tall thin
  { x: 275, y: 28, w: 10, h: 62, shade: 0, windows: [[276,36],[280,36],[276,44],[280,44],[276,52],[280,52],[276,60],[280,60],[276,68],[280,68],[276,76],[280,76]] },
  { x: 273, y: 38, w: 14, h: 10, shade: 0, windows: [] },

  // Far right cluster
  { x: 290, y: 40, w: 30, h: 50, shade: 0, windows: [[292,46],[298,46],[304,46],[310,46],[292,54],[298,54],[304,54],[310,54],[292,62],[298,62],[304,62],[310,62],[292,70],[298,70],[304,70],[310,70],[292,78],[298,78],[304,78],[310,78]] },
];

// Window colors — warm amber/orange for authenticity
const WIN_COLORS = ['#ffd060', '#ffb830', '#ffe090', '#ffc040'];
function winColor(x: number, y: number): string {
  return WIN_COLORS[(x + y) % WIN_COLORS.length];
}

export default function PixelSkylineScene() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const check = () => setActive(
      document.documentElement.getAttribute('data-theme') === 'spider-verse'
    );
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!active) return null;

  // Stars — placed in the sky zone (y < 40)
  const stars = [
    [10,5],[28,8],[45,3],[62,6],[80,4],[100,7],[118,2],[140,8],[158,5],[175,3],
    [192,7],[210,4],[228,6],[245,2],[262,8],[280,4],[298,6],[315,3],[35,11],[95,9],
    [155,10],[215,9],[275,11],[122,4],[182,6],[242,3],[55,9],[165,2],[305,8],
  ].map(([sx, sy], i) => ({
    x: sx, y: sy,
    blink: i % 4 === 0,
    size: i % 5 === 0 ? 2 : 1,
  }));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #010410 0%, #020818 50%, #050c16 100%)',
      }}
    >
      {/* Web strands — top corners */}
      <svg
        viewBox="0 0 300 180"
        style={{ position: 'absolute', top: 0, right: 0, width: 320, height: 200, opacity: 0.22 }}
      >
        <g stroke="#df2a2f" strokeWidth="1.5" fill="none">
          <line x1="300" y1="0" x2="100" y2="180" />
          <line x1="300" y1="0" x2="180" y2="180" />
          <line x1="300" y1="0" x2="260" y2="180" />
          <line x1="300" y1="0" x2="300" y2="100" />
          <polyline points="300,50 240,50 180,110 120,110 80,150" />
          <polyline points="300,100 250,100 190,140 140,140" />
          <polyline points="300,140 270,140 220,170" />
        </g>
      </svg>
      <svg
        viewBox="0 0 250 160"
        style={{ position: 'absolute', bottom: 0, left: 0, width: 280, height: 180, opacity: 0.16 }}
      >
        <g stroke="#df2a2f" strokeWidth="1.5" fill="none">
          <line x1="0" y1="160" x2="160" y2="0" />
          <line x1="0" y1="160" x2="80" y2="0" />
          <line x1="0" y1="160" x2="0" y2="60" />
          <polyline points="0,120 40,120 90,70 130,70" />
          <polyline points="0,80 60,80 110,30 150,30" />
        </g>
      </svg>

      {/* MAIN PIXEL SKYLINE */}
      <svg
        viewBox="0 0 320 90"
        preserveAspectRatio="xMidYMax meet"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '65%',
          imageRendering: 'pixelated',
          imageRenderingMozCrispEdges: 'crisp-edges',
        } as React.CSSProperties}
      >
        {/* Stars in sky */}
        {stars.map((s, i) => (
          <rect
            key={`s${i}`}
            x={s.x} y={s.y}
            width={s.size} height={s.size}
            fill="#c8dcff"
            opacity={s.blink ? undefined : 0.7}
            className={s.blink ? 'sv-blink-slow' : undefined}
          />
        ))}

        {/* Background buildings */}
        {BUILDINGS.filter(b => b.isBg).map((b, i) => (
          <rect
            key={`bg${i}`}
            x={b.x} y={b.y} width={b.w} height={b.h}
            fill={BACKGROUND_SHADES[b.shade % BACKGROUND_SHADES.length]}
          />
        ))}
        {BUILDINGS.filter(b => b.isBg).flatMap((b, bi) =>
          b.windows.map(([wx, wy], wi) => (
            <rect key={`bgw${bi}-${wi}`} x={wx} y={wy} width={2} height={2}
              fill={winColor(wx, wy)} opacity={0.35}
            />
          ))
        )}

        {/* Foreground buildings */}
        {BUILDINGS.filter(b => !b.isBg).map((b, i) => (
          <rect
            key={`fg${i}`}
            x={b.x} y={b.y} width={b.w} height={b.h}
            fill={SHADES[b.shade]}
          />
        ))}

        {/* Antennas */}
        {BUILDINGS.filter(b => !b.isBg && b.antenna).map((b, i) => (
          <g key={`ant${i}`}>
            <rect x={b.x + Math.floor(b.w/2) - 1} y={b.y - 8} width={2} height={8} fill="#8a1020" />
            <rect x={b.x + Math.floor(b.w/2) - 1} y={b.y - 10} width={2} height={2} fill="#df2a2f" />
          </g>
        ))}

        {/* Foreground windows */}
        {BUILDINGS.filter(b => !b.isBg).flatMap((b, bi) =>
          b.windows.map(([wx, wy], wi) => {
            const blinking = (bi + wi) % 7 === 0;
            return (
              <rect
                key={`fw${bi}-${wi}`}
                x={wx} y={wy} width={3} height={3}
                fill={winColor(wx, wy)}
                opacity={blinking ? undefined : 0.85}
                className={blinking ? 'sv-blink' : undefined}
              />
            );
          })
        )}

        {/* Ground fill */}
        <rect x={0} y={88} width={320} height={2} fill="#0e1e38" />
        <rect x={0} y={87} width={320} height={1} fill="#1a2a48" />
      </svg>
    </div>
  );
}
