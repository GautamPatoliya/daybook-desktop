'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import SpiderHeroPixel from './SpiderHeroPixel';
import type { SpiderKind } from './spiderPixelArt';

type Place = 'a' | 'b' | 'c' | 'stage' | 'inline';
type Silk = 'xs' | 'short' | 'long' | 'xl';

type Props = {
  place?: Place;
  silk?: Silk;
  size?: number;
  kind?: SpiderKind;
};

type MotionState = {
  angle: number;
  bob: number;
  stretch: number;
  dragging: boolean;
};

type MotionSeed = MotionState & {
  delay: number;
  duration: number;
};

const SILK_CLASS: Record<Silk, string> = {
  xs: 'sv-silk-xs',
  short: '',
  long: 'sv-silk-long',
  xl: 'sv-silk-xl',
};

const BASE_SILK_LENGTH: Record<Silk, number> = {
  xs: 22,
  short: 36,
  long: 58,
  xl: 96,
};

const GRAB_EVENT = 'sv-spider-grab';

function pickSwing() {
  const mag = 28 + Math.random() * 16;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const start = Math.round(mag * dir * 10) / 10;
  return {
    start,
    bob: Math.round((-0.32 * start) * 10) / 10,
    delay: Math.round(Math.random() * 0.08 * 100) / 100,
    duration: Math.round((2.45 + Math.random() * 0.55) * 100) / 100,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Ceiling knot stays put; silk + spider already at a random angle, then settle. */
export default function HangingSpider({
  place = 'a',
  silk = 'short',
  size = 22,
  kind = 'red',
}: Props) {
  const [hasInteracted, setHasInteracted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const spiderId = useId();
  const mountRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const motionRef = useRef<MotionState>({ angle: 0, bob: 0, stretch: 0, dragging: false });
  const sampleRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const prevSampleRef = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const activePointerRef = useRef<number | null>(null);
  const [seed] = useState<MotionSeed>(() => {
    const swing = pickSwing();
    return {
      angle: swing.start,
      bob: swing.bob,
      stretch: 0,
      dragging: false,
      delay: swing.delay,
      duration: swing.duration,
    };
  });
  const placeClass =
    place === 'stage' || place === 'inline' ? `sv-hang--${place}` : `sv-hang-${place}`;
  const baseLength = BASE_SILK_LENGTH[silk];

  const applyMotionCss = (next: MotionState) => {
    motionRef.current = next;
    const el = mountRef.current;
    if (!el) return;
    el.style.setProperty('--sv-drag-angle', `${next.angle}deg`);
    el.style.setProperty('--sv-drag-bob', `${next.bob}deg`);
    el.style.setProperty('--sv-drag-stretch', `${next.stretch}px`);
    el.style.setProperty('--sv-start', `${next.angle}deg`);
    el.style.setProperty('--sv-bob-start', `${next.bob}deg`);
  };

  const stopAnimation = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const resetMotion = () => {
    stopAnimation();
    const pid = activePointerRef.current;
    activePointerRef.current = null;
    if (pid !== null) {
      try {
        gripRef.current?.releasePointerCapture(pid);
      } catch {
        // ignore
      }
    }
    applyMotionCss({ angle: 0, bob: 0, stretch: 0, dragging: false });
    setDragging(false);
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const anchorX = anchor.left + anchor.width / 2;
    const anchorY = anchor.bottom;
    const dx = clientX - anchorX;
    const dy = clientY - anchorY;

    const angle = clamp((Math.atan2(-dx, Math.max(16, dy)) * 180) / Math.PI, -80, 80);
    const length = Math.hypot(dx, Math.max(8, dy));
    const stretch = clamp(length - baseLength, 0, 80);
    const bob = clamp(-angle * 0.34, -18, 18);

    const next = { angle, bob, stretch, dragging: true };
    prevSampleRef.current = sampleRef.current;
    sampleRef.current = { x: dx, y: Math.max(8, dy), t: performance.now() };
    applyMotionCss(next);
  };

  const settleToRest = () => {
    if (prefersReducedMotion()) {
      resetMotion();
      return;
    }
    stopAnimation();

    const now = performance.now();
    let vx = 0;
    let vy = 0;
    const timeSinceLastMove = now - sampleRef.current.t;
    if (timeSinceLastMove < 100) {
      const dtMs = Math.max(1, sampleRef.current.t - prevSampleRef.current.t);
      vx = ((sampleRef.current.x - prevSampleRef.current.x) / dtMs) * 1000;
      vy = ((sampleRef.current.y - prevSampleRef.current.y) / dtMs) * 1000;
    }

    const rad = (motionRef.current.angle * Math.PI) / 180;
    const currentLength = baseLength + motionRef.current.stretch;
    let x = -Math.sin(rad) * currentLength;
    let y = Math.cos(rad) * currentLength;

    const mass = 1.0;
    const gravity = 1200;
    const k = 220;
    const damping = 2.0;
    const restLength = baseLength - (mass * gravity) / k;

    let lastTime = performance.now();
    const durationMaxMs = 4500;
    const start = lastTime;

    const frame = (frameTime: number) => {
      const elapsedMs = frameTime - start;
      const dt = Math.min((frameTime - lastTime) / 1000, 0.033);
      lastTime = frameTime;

      const length = Math.hypot(x, y);
      const springForce = length > restLength ? -k * (length - restLength) : 0;
      const fx = (x / length) * springForce - damping * vx;
      const fy = (y / length) * springForce - damping * vy + gravity * mass;

      vx += (fx / mass) * dt;
      vy += (fy / mass) * dt;
      x += vx * dt;
      y += vy * dt;

      const angle = (Math.atan2(-x, Math.max(1, y)) * 180) / Math.PI;
      const stretchRaw = length - baseLength;
      const stretch = Math.max(-5, stretchRaw);
      const bob = clamp(-angle * 0.34, -18, 18);
      const speedSq = vx * vx + vy * vy;
      const done =
        elapsedMs > durationMaxMs ||
        (speedSq < 10 && Math.abs(angle) < 0.2 && Math.abs(stretchRaw) < 0.5);

      if (done) {
        rafRef.current = null;
        applyMotionCss({ angle: 0, bob: 0, stretch: 0, dragging: false });
        setDragging(false);
      } else {
        applyMotionCss({ angle, bob, stretch, dragging: true });
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    applyMotionCss({
      angle: seed.angle,
      bob: seed.bob,
      stretch: 0,
      dragging: false,
    });
  }, [seed.angle, seed.bob]);

  useEffect(() => {
    const handleOtherGrab = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string }>).detail;
      if (detail?.id !== spiderId && activePointerRef.current !== null) {
        resetMotion();
      }
    };
    window.addEventListener(GRAB_EVENT, handleOtherGrab as EventListener);
    return () => {
      window.removeEventListener(GRAB_EVENT, handleOtherGrab as EventListener);
      stopAnimation();
    };
  }, [spiderId]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      applyMotionCss({ angle: 0, bob: 0, stretch: 0, dragging: false });
      setDragging(false);
    }
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || prefersReducedMotion()) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    setHasInteracted(true);
    setDragging(true);
    activePointerRef.current = event.pointerId;

    const now = performance.now();
    const rad = (motionRef.current.angle * Math.PI) / 180;
    const currentLength = baseLength + motionRef.current.stretch;
    const x = -Math.sin(rad) * currentLength;
    const y = Math.cos(rad) * currentLength;

    sampleRef.current = { x, y, t: now };
    prevSampleRef.current = sampleRef.current;

    window.dispatchEvent(new CustomEvent(GRAB_EVENT, { detail: { id: spiderId } }));
    gripRef.current?.setPointerCapture(event.pointerId);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    event.preventDefault();
    gripRef.current?.releasePointerCapture(event.pointerId);
    activePointerRef.current = null;
    settleToRest();
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    gripRef.current?.releasePointerCapture(event.pointerId);
    resetMotion();
  };

  return (
    <div
      ref={mountRef}
      className={`sv-hang-mount ${placeClass}${hasInteracted ? ' is-interacted' : ''}`}
      style={
        {
          '--sv-start': `${seed.angle}deg`,
          '--sv-bob-start': `${seed.bob}deg`,
          '--sv-swing-delay': `${seed.delay}s`,
          '--sv-swing-dur': `${seed.duration}s`,
          '--sv-drag-angle': `${seed.angle}deg`,
          '--sv-drag-bob': `${seed.bob}deg`,
          '--sv-drag-stretch': '0px',
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <span ref={anchorRef} className="sv-hang-anchor" />
      <div className={`sv-hang-arm${dragging ? ' is-dragging' : ''}`}>
        <span className={`sv-silk ${SILK_CLASS[silk]}`.trim()} />
        <button
          ref={gripRef}
          type="button"
          className="sv-hang-grip"
          aria-hidden="true"
          tabIndex={-1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          <SpiderHeroPixel variant="spider" kind={kind} size={size} />
        </button>
      </div>
    </div>
  );
}
