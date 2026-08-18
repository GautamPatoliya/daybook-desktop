'use client';

import React, { useEffect, useState } from 'react';
import PixelWebCorner from './PixelWebCorner';
import SpiderHeroPixel from './spider/SpiderHeroPixel';

/** Subtle corner webs + tiny hero accents — spider-verse theme only. */
export default function SpiderVerseDecor() {
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
    <div className="sv-decor-layer" aria-hidden="true">
      <div className="sv-decor sv-decor-tl">
        <PixelWebCorner position="top-left" size={72} />
      </div>
      <div className="sv-decor sv-decor-tr">
        <PixelWebCorner position="top-right" size={72} />
      </div>
      <div className="sv-decor sv-decor-bl">
        <PixelWebCorner position="bottom-left" size={56} />
      </div>
      <div className="sv-decor sv-decor-br">
        <PixelWebCorner position="bottom-right" size={56} />
      </div>
      <div className="sv-decor sv-decor-hero">
        <SpiderHeroPixel variant="mask" size={28} />
      </div>
    </div>
  );
}
