'use client';

import React, { useEffect, useState } from 'react';
import HangingSpider from './spider/HangingSpider';
import SpiderHeroPixel from './spider/SpiderHeroPixel';

const LABELS: Record<string, string> = {
  none: 'THWIP — DROP A TASK',
  wip: 'SWINGING INTO ACTION',
  done: 'HERO LANDING — NICE!',
};

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

  return (
    <div className="sv-empty-state">
      <div className={`sv-empty-art${status === 'done' ? '' : ' sv-empty-art--open'}`}>
        {status === 'none' && <HangingSpider place="inline" silk="long" size={56} kind="ink" />}
        {status === 'wip' && <HangingSpider place="inline" silk="long" size={64} kind="blue" />}
        {status === 'done' && <SpiderHeroPixel variant="land" size={140} />}
      </div>
      <p className="sv-empty-label">{LABELS[status]}</p>
    </div>
  );
}
