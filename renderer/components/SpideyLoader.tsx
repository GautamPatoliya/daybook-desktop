'use client';

import React, { useEffect, useState } from 'react';
import Cobweb from './spider/Cobweb';
import BrandMark from './BrandMark';

/** Brand-led page loader — polished for Default and Spider-Verse. */
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
      <div className="db-loader" role="status" aria-live="polite" aria-busy="true">
        <div className="db-loader-glow" aria-hidden />
        <div className="db-loader-mark" aria-hidden>
          <svg className="db-loader-ring" viewBox="0 0 96 96" width="96" height="96">
            <circle className="db-loader-ring-track" cx="48" cy="48" r="40" />
            <circle className="db-loader-ring-arc" cx="48" cy="48" r="40" />
          </svg>
          <span className="db-loader-icon db-loader-icon--logo">
            <BrandMark size={40} />
          </span>
        </div>
        <div className="db-loader-copy">
          <p className="db-loader-brand">Daybook</p>
          <p className="db-loader-label">{label}</p>
        </div>
        <div className="db-loader-bar" aria-hidden>
          <span className="db-loader-bar-fill" />
        </div>
      </div>
    );
  }

  return (
    <div className="sv-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="sv-loader-stage">
        <span className="sv-loader-web sv-loader-web--tl" aria-hidden>
          <Cobweb size={110} corner="top-left" opacity={0.5} />
        </span>
        <span className="sv-loader-web sv-loader-web--tr" aria-hidden>
          <Cobweb size={110} corner="top-right" opacity={0.5} />
        </span>
        <span className="sv-loader-web sv-loader-web--bl" aria-hidden>
          <Cobweb size={72} corner="bottom-left" opacity={0.28} />
        </span>
        <span className="sv-loader-web sv-loader-web--br" aria-hidden>
          <Cobweb size={72} corner="bottom-right" opacity={0.28} />
        </span>

        <div className="sv-loader-hero sv-loader-hero--brand" aria-hidden>
          <BrandMark size={88} className="sv-loader-brand-mark" />
        </div>

        <p className="sv-loader-brand">DAYBOOK</p>
        <p className="sv-loader-kicker">THWIP</p>
        <p className="sv-loader-label">{label}</p>
        <div className="sv-loader-bar" aria-hidden>
          <span className="sv-loader-bar-fill" />
        </div>
      </div>
    </div>
  );
}
