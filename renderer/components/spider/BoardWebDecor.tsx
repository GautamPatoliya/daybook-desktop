'use client';

import React, { useEffect, useState } from 'react';
import Cobweb from './Cobweb';
import HangingSpider from './HangingSpider';

/** Board-only silk: hanging strands + faint web. Never captures clicks. */
export default function BoardWebDecor() {
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
    <div className="sv-board-web" aria-hidden="true">
      <div className="sv-board-web-bg">
        <Cobweb size={160} corner="top-left" opacity={0.22} />
      </div>
      <HangingSpider place="a" silk="short" size={24} kind="ink" />
      <HangingSpider place="b" silk="long" size={32} kind="red" />
      <HangingSpider place="c" silk="short" size={22} kind="gold" />
    </div>
  );
}
