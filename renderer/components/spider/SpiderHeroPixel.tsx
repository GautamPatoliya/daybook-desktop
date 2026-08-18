'use client';

import React from 'react';
import { EMPTY_SCENES, heroMaskSprite, spiderSprite } from './spiderPixelArt';
import PixelSprite from './PixelSprite';

export type HeroVariant = 'mask' | 'spider' | 'hang' | 'swing' | 'land';

type Props = {
  variant?: HeroVariant;
  size?: number;
  className?: string;
};

export default function SpiderHeroPixel({ variant = 'mask', size = 32, className }: Props) {
  if (variant === 'spider') {
    return (
      <PixelSprite pixels={spiderSprite(0, 0)} viewSize={16} displaySize={size} className={className} />
    );
  }

  if (variant === 'mask') {
    return (
      <PixelSprite pixels={heroMaskSprite(0, 0)} viewSize={16} displaySize={size} className={className} />
    );
  }

  const sceneKey = variant === 'hang' ? 'none' : variant === 'swing' ? 'wip' : 'done';
  return (
    <PixelSprite
      pixels={EMPTY_SCENES[sceneKey]()}
      viewSize={48}
      displaySize={size}
      className={className}
    />
  );
}
