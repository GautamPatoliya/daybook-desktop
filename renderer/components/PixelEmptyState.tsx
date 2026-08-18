'use client';

import React, { useEffect, useState } from 'react';
import SpiderHeroPixel from './spider/SpiderHeroPixel';

const LABELS: Record<string, string> = {
  none: 'THWIP — DROP A TASK',
  wip: 'SWINGING INTO ACTION',
  done: 'HERO LANDING — NICE!',
};

const VARIANTS = {
  none: 'hang',
  wip: 'swing',
  done: 'land',
} as const;

interface Props { status: 'none' | 'wip' | 'done' }

export default function PixelEmptyState({ status }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const check = () =>
      setActive(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!active) return null;

  const variant = VARIANTS[status] ?? 'hang';

  return (
    <div className="sv-empty-state">
      <div className="sv-empty-art">
        <SpiderHeroPixel variant={variant} size={140} />
      </div>
      <p className="sv-empty-label">{LABELS[status]}</p>
    </div>
  );
}
