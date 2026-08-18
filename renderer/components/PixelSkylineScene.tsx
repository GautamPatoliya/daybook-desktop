'use client';
import React, { useEffect, useState } from 'react';

// Subtle pixel skyline — ambient background only, not a focal point.
// Matches Spidey Tracker: dark map zone at bottom, no webs or blinking.

const SHADES = ['#040810', '#060c18', '#070e1e'];
const BACKGROUND_SHADES = ['#060a16', '#080e1c', '#0a1220'];

interface BuildingDef {
  x: number; y: number; w: number; h: number;
  shade: number; isBg?: boolean;
  windows: Array<[number, number]>;
}

const BUILDINGS: BuildingDef[] = [
  { x: 5,   y: 50, w: 18, h: 40, shade: 0, isBg: true, windows: [[8,55],[12,62]] },
  { x: 28,  y: 44, w: 14, h: 46, shade: 1, isBg: true, windows: [[30,48],[35,56]] },
  { x: 48,  y: 55, w: 20, h: 35, shade: 2, isBg: true, windows: [[50,60],[56,68]] },
  { x: 88,  y: 52, w: 16, h: 38, shade: 0, isBg: true, windows: [[90,58],[96,66]] },
  { x: 130, y: 48, w: 22, h: 42, shade: 1, isBg: true, windows: [[133,53],[139,62]] },
  { x: 168, y: 56, w: 14, h: 34, shade: 2, isBg: true, windows: [[170,60],[176,68]] },
  { x: 200, y: 50, w: 18, h: 40, shade: 0, isBg: true, windows: [[202,55],[208,63]] },
  { x: 236, y: 44, w: 24, h: 46, shade: 1, isBg: true, windows: [[238,50],[244,58]] },
  { x: 278, y: 52, w: 16, h: 38, shade: 2, isBg: true, windows: [[280,58],[286,66]] },
  { x: 0,   y: 30, w: 20, h: 60, shade: 0, windows: [[2,46],[8,54],[14,62]] },
  { x: 24,  y: 40, w: 28, h: 50, shade: 0, windows: [[26,53],[38,61],[44,69]] },
  { x: 58,  y: 20, w: 12, h: 70, shade: 0, windows: [[60,36],[64,52],[64,68]] },
  { x: 78,  y: 35, w: 36, h: 55, shade: 0, windows: [[80,48],[92,56],[104,64]] },
  { x: 120, y: 42, w: 24, h: 48, shade: 0, windows: [[122,56],[134,64]] },
  { x: 150, y: 18, w: 14, h: 72, shade: 0, windows: [[152,42],[158,58]] },
  { x: 172, y: 38, w: 30, h: 52, shade: 0, windows: [[174,52],[186,60],[198,68]] },
  { x: 208, y: 22, w: 16, h: 68, shade: 0, windows: [[210,38],[218,54]] },
  { x: 230, y: 30, w: 38, h: 60, shade: 0, windows: [[232,44],[250,52],[262,60]] },
  { x: 275, y: 28, w: 10, h: 62, shade: 0, windows: [[276,44],[280,60]] },
  { x: 290, y: 40, w: 30, h: 50, shade: 0, windows: [[292,54],[304,62]] },
];

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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        contain: 'paint',
        background: 'linear-gradient(180deg, #050a14 0%, #071018 55%, #0a1420 100%)',
        opacity: 0.55,
      }}
    >
      <svg
        viewBox="0 0 320 90"
        preserveAspectRatio="xMidYMax meet"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '38%',
          imageRendering: 'pixelated',
        } as React.CSSProperties}
      >
        {BUILDINGS.filter(b => b.isBg).map((b, i) => (
          <rect
            key={`bg${i}`}
            x={b.x} y={b.y} width={b.w} height={b.h}
            fill={BACKGROUND_SHADES[b.shade % BACKGROUND_SHADES.length]}
          />
        ))}
        {BUILDINGS.filter(b => !b.isBg).map((b, i) => (
          <rect
            key={`fg${i}`}
            x={b.x} y={b.y} width={b.w} height={b.h}
            fill={SHADES[b.shade]}
          />
        ))}
        {BUILDINGS.flatMap((b, bi) =>
          b.windows.map(([wx, wy], wi) => (
            <rect
              key={`w${bi}-${wi}`}
              x={wx} y={wy} width={2} height={2}
              fill="#ffd060"
              opacity={0.25}
            />
          ))
        )}
        <rect x={0} y={88} width={320} height={2} fill="#0e1e38" />
      </svg>
    </div>
  );
}
