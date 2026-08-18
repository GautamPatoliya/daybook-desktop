'use client';

import React, { useEffect, useState } from 'react';
import PixelWebCorner from './PixelWebCorner';

export default function SpiderVerseBackground() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      setIsActive(document.documentElement.getAttribute('data-theme') === 'spider-verse');
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  if (!isActive) return null;

  return (
    <div
      className="sv-bg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#010208'
      }}
    >
      {/* Halftone Pattern Overlay */}
      <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.05 }}>
        <defs>
          <pattern id="halftone" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="2" height="2" fill="#fff" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#halftone)" />
      </svg>

      {/* Star Field */}
      <svg width="100%" height="100%" style={{ position: 'absolute', opacity: 0.5 }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <rect
            key={`star-${i}`}
            x={`${Math.random() * 100}%`}
            y={`${Math.random() * 50}%`}
            width="2"
            height="2"
            fill="#fff"
            style={{
              animation: `twinkle ${2 + Math.random() * 3}s infinite ${Math.random()}s`,
            }}
          />
        ))}
      </svg>

      {/* Web Decorations */}
      <div style={{ position: 'absolute', top: 0, right: 0 }}>
        <PixelWebCorner position="top-right" size={150} />
      </div>
      <div style={{ position: 'absolute', bottom: 0, left: 0 }}>
        <PixelWebCorner position="bottom-left" size={120} />
      </div>

      {/* City Skyline */}
      <svg
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMax slice"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '400px',
          opacity: 0.4
        }}
      >
        {/* Buildings background layer */}
        {Array.from({ length: 30 }).map((_, i) => {
          const width = 30 + Math.random() * 60;
          const height = 100 + Math.random() * 200;
          const x = i * (1200 / 30) - 20 + Math.random() * 40;
          return (
            <rect
              key={`bg-${i}`}
              x={x}
              y={400 - height}
              width={width}
              height={height}
              fill="#060914"
            />
          );
        })}

        {/* Buildings foreground layer */}
        {Array.from({ length: 25 }).map((_, i) => {
          const width = 40 + Math.random() * 80;
          const height = 50 + Math.random() * 250;
          const x = i * (1200 / 25) - 10;
          const colors = ['#0a0e1a', '#0c1020', '#070b15'];
          const color = colors[Math.floor(Math.random() * colors.length)];
          return (
            <rect
              key={`fg-${i}`}
              x={x}
              y={400 - height}
              width={width}
              height={height}
              fill={color}
            />
          );
        })}

        {/* Lit Windows */}
        {Array.from({ length: 80 }).map((_, i) => {
          const x = Math.random() * 1200;
          const y = 150 + Math.random() * 250;
          const isOrange = Math.random() > 0.5;
          return (
            <rect
              key={`win-${i}`}
              x={x}
              y={y}
              width="4"
              height="4"
              fill={isOrange ? '#FF8C00' : '#FFD700'}
              opacity={0.3 + Math.random() * 0.5}
            />
          );
        })}
      </svg>
    </div>
  );
}
