'use client';

import React, { useEffect, useState } from 'react';
import PixelSprite from './PixelSprite';
import { sceneLand, thwipSprite } from './spiderPixelArt';
import { onSpiderFx, SPIDER_FX_MS, type SpiderFxKind } from '../../lib/spiderFx';

type Burst = {
  id: number;
  kind: SpiderFxKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  dist: number;
  angle: number;
};

function geometry(
  toSelector: string,
  from?: { x: number; y: number },
): Omit<Burst, 'id' | 'kind'> | null {
  const el = document.querySelector(toSelector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  const origin = from ?? { x: to.x, y: Math.max(48, r.top - 36) };
  const dx = to.x - origin.x;
  const dy = to.y - origin.y;
  return {
    from: origin,
    to,
    dist: Math.max(24, Math.hypot(dx, dy)),
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/** One-shot pixel bursts for add / complete. Pointer-events none. */
export default function ActionCast() {
  const [burst, setBurst] = useState<Burst | null>(null);

  useEffect(() => {
    return onSpiderFx((detail) => {
      const geo = geometry(detail.toSelector, detail.from);
      if (!geo) return;
      const next: Burst = { id: Date.now(), kind: detail.kind, ...geo };
      setBurst(next);
      window.setTimeout(() => {
        setBurst((cur) => (cur?.id === next.id ? null : cur));
      }, SPIDER_FX_MS[detail.kind] + 40);
    });
  }, []);

  if (!burst) return null;

  if (burst.kind === 'land') {
    return (
      <div className="sv-fx sv-fx-land" aria-hidden style={{ left: burst.to.x, top: burst.to.y }}>
        <PixelSprite pixels={sceneLand()} viewSize={48} displaySize={56} />
      </div>
    );
  }

  return (
    <div className="sv-fx sv-fx-thwip" aria-hidden>
      <span
        className="sv-fx-silk"
        style={
          {
            left: burst.from.x,
            top: burst.from.y,
            width: burst.dist,
            '--sv-fx-rot': `${burst.angle}deg`,
          } as React.CSSProperties
        }
      />
      <span
        className="sv-fx-shooter"
        style={
          {
            left: burst.from.x,
            top: burst.from.y,
            '--sv-fx-flip': Math.abs(burst.angle) > 90 ? -1 : 1,
          } as React.CSSProperties
        }
      >
        <PixelSprite pixels={thwipSprite()} viewSize={16} displaySize={32} />
      </span>
      <span className="sv-fx-hit" style={{ left: burst.to.x, top: burst.to.y }} />
    </div>
  );
}
