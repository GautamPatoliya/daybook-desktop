'use client';

import React, { useState } from 'react';
import SpiderHeroPixel from './SpiderHeroPixel';
import type { SpiderKind } from './spiderPixelArt';

type Place = 'a' | 'b' | 'c' | 'stage' | 'inline';
type Silk = 'xs' | 'short' | 'long' | 'xl';

type Props = {
  place?: Place;
  silk?: Silk;
  size?: number;
  kind?: SpiderKind;
};

const SILK_CLASS: Record<Silk, string> = {
  xs: 'sv-silk-xs',
  short: '',
  long: 'sv-silk-long',
  xl: 'sv-silk-xl',
};

function pickSwing() {
  const mag = 28 + Math.random() * 16;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const start = Math.round(mag * dir * 10) / 10;
  return {
    start,
    bob: Math.round((-0.32 * start) * 10) / 10,
    delay: Math.round(Math.random() * 0.08 * 100) / 100,
    duration: Math.round((2.45 + Math.random() * 0.55) * 100) / 100,
  };
}

/** Ceiling knot stays put; silk + spider already at a random angle, then settle. */
export default function HangingSpider({
  place = 'a',
  silk = 'short',
  size = 22,
  kind = 'red',
}: Props) {
  const [swing] = useState(pickSwing);
  const placeClass =
    place === 'stage' || place === 'inline' ? `sv-hang--${place}` : `sv-hang-${place}`;

  return (
    <div
      className={`sv-hang-mount ${placeClass}`}
      style={
        {
          '--sv-start': `${swing.start}deg`,
          '--sv-bob-start': `${swing.bob}deg`,
          '--sv-swing-delay': `${swing.delay}s`,
          '--sv-swing-dur': `${swing.duration}s`,
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <span className="sv-hang-anchor" />
      <div className="sv-hang-arm">
        <span className={`sv-silk ${SILK_CLASS[silk]}`.trim()} />
        <span className="sv-hang-bob">
          <SpiderHeroPixel variant="spider" kind={kind} size={size} />
        </span>
      </div>
    </div>
  );
}
