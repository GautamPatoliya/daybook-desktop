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
  const spiderId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const gripRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const motionRef = useRef<MotionState>({ angle: 0, bob: 0, stretch: 0, dragging: false });
  const sampleRef = useRef<{ angle: number; stretch: number; t: number }>({ angle: 0, stretch: 0, t: 0 });
  const prevSampleRef = useRef<{ angle: number; stretch: number; t: number }>({ angle: 0, stretch: 0, t: 0 });
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
  const [motion, setMotion] = useState<MotionState>({
    angle: seed.angle,
    bob: seed.bob,
    stretch: 0,
    dragging: false,
  });
  const placeClass =
    place === 'stage' || place === 'inline' ? `sv-hang--${place}` : `sv-hang-${place}`;
  const baseLength = BASE_SILK_LENGTH[silk];

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
    const next = { angle: 0, bob: 0, stretch: 0, dragging: false };
    motionRef.current = next;
    setMotion(next);
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const anchorX = anchor.left + anchor.width / 2;
    const anchorY = anchor.bottom;
    const dx = clientX - anchorX;
    const dy = clientY - anchorY;
    const angle = clamp((Math.atan2(-dx, Math.max(16, dy)) * 180) / Math.PI, -52, 52);
    const length = Math.hypot(dx, Math.max(8, dy));
    // Only stretch (no compression): silk can elongate, then elastically rebound.
    const stretch = clamp(length - baseLength, 0, 82);
    const bob = clamp(-angle * 0.34, -18, 18);
    const next = { angle, bob, stretch, dragging: true };
    prevSampleRef.current = sampleRef.current;
    sampleRef.current = { angle, stretch, t: performance.now() };
    motionRef.current = next;
    setMotion(next);
  };

  const settleToRest = (from: MotionState) => {
    if (prefersReducedMotion()) {
      resetMotion();
      return;
    }
    stopAnimation();
    const start = performance.now();

    const dtMs = sampleRef.current.t - prevSampleRef.current.t;
    const dt = Math.max(1, dtMs);
    // velocity units: angle (deg/ms) -> (rad/s), stretch (px/ms) -> (px/s)
    const velocityAngleDegPerMs = (sampleRef.current.angle - prevSampleRef.current.angle) / dt;
    const velocityStretchPxPerMs =
      (sampleRef.current.stretch - prevSampleRef.current.stretch) / dt;

    const degToRad = Math.PI / 180;
    const radToDeg = 180 / Math.PI;
    const theta0 = from.angle * degToRad;
    const s0 = from.stretch;
    const thetaDot0 = velocityAngleDegPerMs * degToRad * 1000;
    const sDot0 = velocityStretchPxPerMs * 1000;

    // "Science-ish": pendulum small-angle frequency depends on effective length.
    // Map pixels to meters approximately (calibrated by current baseLength values).
    const PX_TO_M = 58;
    const effectiveLengthM = clamp((baseLength + s0) / PX_TO_M, 0.15, 6);
    const G = 9.81;
    const omega0 = Math.sqrt(G / effectiveLengthM); // rad/s
    const zeta = 0.14; // damping ratio
    const omegaD = omega0 * Math.sqrt(Math.max(0.0001, 1 - zeta * zeta));

    const A = theta0;
    const B =
      (thetaDot0 + zeta * omega0 * theta0) / (omegaD || (omega0 + 0.0001));

    // Silk stretch is an independent elastic spring.
    const omegaS = (2 * Math.PI) / 0.72; // rad/s (period ~0.72s)
    const zetaS = 0.22;
    const omegaSD = omegaS * Math.sqrt(Math.max(0.0001, 1 - zetaS * zetaS));
    const Cs = sDot0 + zetaS * omegaS * s0;

    const durationMaxMs = 2600;

    const frame = (now: number) => {
      const elapsedMs = now - start;
      const t = elapsedMs / 1000;

      const expP = Math.exp(-zeta * omega0 * t);
      const angleRad = expP * (A * Math.cos(omegaD * t) + B * Math.sin(omegaD * t));

      const expS = Math.exp(-zetaS * omegaS * t);
      const stretchRaw =
        expS *
        (s0 * Math.cos(omegaSD * t) + (Cs / (omegaSD || (omegaS + 0.0001))) * Math.sin(omegaSD * t));
      const stretch = Math.max(0, stretchRaw);

      const angle = angleRad * radToDeg;
      const bob = clamp(-angle * 0.34, -18, 18);

      const done =
        elapsedMs > durationMaxMs ||
        (Math.abs(angle) < 0.18 && stretch < 0.22);

      const next = {
        angle,
        bob,
        stretch,
        // Keep the "controlled" visual state until we finish the settle.
        dragging: !done,
      };
      motionRef.current = next;
      setMotion(next);
      if (!done) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        rafRef.current = null;
        const rest = { angle: 0, bob: 0, stretch: 0, dragging: false };
        motionRef.current = rest;
        setMotion(rest);
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  };

  useEffect(() => {
    motionRef.current = motion;
  }, [motion]);

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
      const next = { angle: 0, bob: 0, stretch: 0, dragging: false };
      motionRef.current = next;
      setMotion(next);
    }
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || prefersReducedMotion()) return;
    event.preventDefault();
    event.stopPropagation();
    stopAnimation();
    setHasInteracted(true);
    activePointerRef.current = event.pointerId;
    const now = performance.now();
    sampleRef.current = { angle: motionRef.current.angle, stretch: motionRef.current.stretch, t: now };
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
    const releaseState = motionRef.current.dragging
      ? motionRef.current
      : { ...motionRef.current, dragging: false };
    gripRef.current?.releasePointerCapture(event.pointerId);
    activePointerRef.current = null;
    settleToRest(releaseState);
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    gripRef.current?.releasePointerCapture(event.pointerId);
    resetMotion();
  };

  return (
    <div
      className={`sv-hang-mount ${placeClass}${hasInteracted ? ' is-interacted' : ''}`}
      style={
        {
          '--sv-start': `${motion.angle}deg`,
          '--sv-bob-start': `${motion.bob}deg`,
          '--sv-swing-delay': `${seed.delay}s`,
          '--sv-swing-dur': `${seed.duration}s`,
          '--sv-drag-angle': `${motion.angle}deg`,
          '--sv-drag-bob': `${motion.bob}deg`,
          '--sv-drag-stretch': `${motion.stretch}px`,
        } as React.CSSProperties
      }
      suppressHydrationWarning
    >
      <span ref={anchorRef} className="sv-hang-anchor" />
      <div className={`sv-hang-arm${motion.dragging ? ' is-dragging' : ''}`}>
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
