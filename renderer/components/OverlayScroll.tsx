'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type UIEvent,
} from 'react';
import { cn } from '../lib/cn';

type Props = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Cap height; content shorter than this shrinks the box. */
  maxHeight?: number | string;
  /** Fixed height (fills parent when '100%'). */
  height?: number | string;
  autoHide?: boolean;
  onScroll?: (e: UIEvent<HTMLDivElement>) => void;
  'aria-label'?: string;
};

/**
 * Lightweight overlay scroller - no Radix, no native bars, thumb tracks scroll 1:1.
 */
export function OverlayScroll({
  children,
  className,
  style,
  maxHeight,
  height,
  autoHide = true,
  onScroll,
  'aria-label': ariaLabel,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false });
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null);
  const thumbRef = useRef(thumb);
  thumbRef.current = thumb;

  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight + 1) {
      setThumb({ top: 0, height: 0, visible: false });
      return;
    }
    const thumbH = Math.max(20, (clientHeight / scrollHeight) * clientHeight);
    const maxTop = Math.max(0, clientHeight - thumbH);
    const range = scrollHeight - clientHeight;
    const top = range <= 0 ? 0 : (scrollTop / range) * maxTop;
    setThumb({ top, height: thumbH, visible: true });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [measure, children, maxHeight, height]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    const child = el.firstElementChild;
    if (child) ro.observe(child);
    return () => ro.disconnect();
  }, [measure, children]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = viewportRef.current;
      const drag = dragRef.current;
      if (!el || !drag) return;
      const { scrollHeight, clientHeight } = el;
      const thumbH = Math.max(20, (clientHeight / scrollHeight) * clientHeight);
      const maxTop = Math.max(0, clientHeight - thumbH);
      const maxScroll = scrollHeight - clientHeight;
      if (maxTop <= 0 || maxScroll <= 0) return;
      const nextTop = Math.max(0, Math.min(maxTop, drag.startTop + (e.clientY - drag.startY)));
      el.scrollTop = (nextTop / maxTop) * maxScroll;
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    measure();
    onScroll?.(e);
  };

  return (
    <div
      className={cn('ui-overlay-scroll', autoHide && 'ui-overlay-scroll--autohide', className)}
      style={{ ...style, maxHeight, height }}
    >
      <div
        ref={viewportRef}
        className="ui-overlay-scroll-viewport"
        role={ariaLabel ? 'region' : undefined}
        aria-label={ariaLabel}
        style={
          height != null
            ? { height: '100%', maxHeight: '100%' }
            : maxHeight != null
              ? { maxHeight }
              : undefined
        }
        onScroll={handleScroll}
      >
        <div className="ui-overlay-scroll-content">{children}</div>
      </div>
      {thumb.visible && (
        <div className="ui-overlay-scroll-bar" aria-hidden>
          <div
            className="ui-overlay-scroll-thumb"
            style={{ transform: `translateY(${thumb.top}px)`, height: thumb.height }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragRef.current = {
                startY: e.clientY,
                startTop: thumbRef.current.top,
              };
            }}
          />
        </div>
      )}
    </div>
  );
}

export default OverlayScroll;
