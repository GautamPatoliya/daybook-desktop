'use client';

import React, { useEffect, useState } from 'react';
import Cobweb from './spider/Cobweb';
import SpiderHeroPixel from './spider/SpiderHeroPixel';

/** Corner cobwebs + mask — spider-verse only. Clipped; no page overflow. */
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
        <Cobweb size={92} corner="top-left" opacity={0.55} />
      </div>
      <div className="sv-decor sv-decor-tr">
        <Cobweb size={92} corner="top-right" opacity={0.5} />
      </div>
      <div className="sv-decor sv-decor-bl">
        <Cobweb size={78} corner="bottom-left" opacity={0.42} />
      </div>
      <div className="sv-decor sv-decor-br">
        <Cobweb size={78} corner="bottom-right" opacity={0.42} />
      </div>
      <div className="sv-decor sv-decor-hero">
        <SpiderHeroPixel variant="mask" size={26} />
      </div>
    </div>
  );
}
