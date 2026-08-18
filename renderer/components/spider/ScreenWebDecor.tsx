'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Cobweb from './Cobweb';
import HangingSpider from './HangingSpider';
import SpiderHeroPixel from './SpiderHeroPixel';

type Scene = 'board' | 'projects' | 'analytics' | 'models' | 'settings' | 'updates' | 'onboarding';

function sceneFromPath(path: string | null): Scene {
  if (!path) return 'board';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/analytics')) return 'analytics';
  if (path.startsWith('/models')) return 'models';
  if (path.startsWith('/settings')) return 'settings';
  if (path.startsWith('/updates')) return 'updates';
  if (path.startsWith('/onboarding')) return 'onboarding';
  return 'board';
}

/** Per-screen silk + spiders. Board hanging strands live in BoardWebDecor. */
export default function ScreenWebDecor() {
  const pathname = usePathname();
  const scene = sceneFromPath(pathname);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const check = () =>
      setActive(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  if (!active || scene === 'board') return null;

  return (
    <div className={`sv-screen-web sv-screen-${scene}`} aria-hidden="true">
      {scene === 'projects' && (
        <>
          <div className="sv-screen-web-tr">
            <Cobweb size={110} corner="top-right" opacity={0.4} />
          </div>
          <HangingSpider place="c" silk="long" size={28} kind="blue" />
        </>
      )}
      {scene === 'analytics' && (
        <>
          <div className="sv-screen-web-tl">
            <Cobweb size={100} corner="top-left" opacity={0.35} />
          </div>
          <HangingSpider place="a" silk="short" size={26} kind="ink" />
          <div className="sv-decor-hero">
            <SpiderHeroPixel variant="land" size={44} />
          </div>
        </>
      )}
      {scene === 'models' && (
        <>
          <div className="sv-screen-web-tr">
            <Cobweb size={96} corner="top-right" opacity={0.38} />
          </div>
          <HangingSpider place="b" silk="long" size={26} kind="gold" />
        </>
      )}
      {scene === 'settings' && (
        <>
          <div className="sv-screen-web-tr">
            <Cobweb size={88} corner="top-right" opacity={0.32} />
          </div>
          <HangingSpider place="c" silk="short" size={24} kind="red" />
        </>
      )}
      {scene === 'updates' && (
        <>
          <div className="sv-screen-web-tl">
            <Cobweb size={90} corner="top-left" opacity={0.34} />
          </div>
          <HangingSpider place="b" silk="long" size={28} kind="blue" />
        </>
      )}
      {scene === 'onboarding' && (
        <>
          <div className="sv-screen-web-tl">
            <Cobweb size={120} corner="top-left" opacity={0.4} />
          </div>
          <div className="sv-screen-web-br">
            <Cobweb size={100} corner="bottom-right" opacity={0.35} />
          </div>
          <HangingSpider place="c" silk="long" size={30} kind="gold" />
        </>
      )}
    </div>
  );
}
