'use client';

import React, { useEffect, useState } from 'react';
import HangingSpider from './spider/HangingSpider';
import Cobweb from './spider/Cobweb';

/** Spidey-mask loader when Spider-Verse is on; compact fallback otherwise. */
export default function SpideyLoader({ label }: { label: string }) {
  const [spidey, setSpidey] = useState(false);

  useEffect(() => {
    const check = () =>
      setSpidey(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!spidey) {
    return (
      <div className="sv-loader sv-loader--plain">
        <span className="sv-loader-dot" />
        <p className="page-sub">{label}</p>
      </div>
    );
  }

  return (
    <div className="sv-loader" role="status" aria-live="polite">
      <div className="sv-loader-stage">
        <span className="sv-loader-web sv-loader-web--tl" aria-hidden>
          <Cobweb size={120} corner="top-left" opacity={0.55} />
        </span>
        <span className="sv-loader-web sv-loader-web--tr" aria-hidden>
          <Cobweb size={120} corner="top-right" opacity={0.55} />
        </span>
        <div className="sv-loader-troupe">
          <HangingSpider place="stage" silk="xs" size={44} kind="ink" />
          <HangingSpider place="stage" silk="long" size={64} kind="blue" />
          <HangingSpider place="stage" silk="xl" size={84} kind="red" />
          <HangingSpider place="stage" silk="short" size={52} kind="gold" />
          <HangingSpider place="stage" silk="xs" size={40} kind="hero" />
        </div>
        <p className="sv-loader-kicker">THWIP</p>
        <p className="sv-loader-label">{label}</p>
      </div>
    </div>
  );
}
