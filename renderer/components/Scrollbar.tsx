'use client';

import {
  forwardRef,
  memo,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type UIEventHandler,
} from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '../lib/cn';
import { ScrollBar } from './ui/scroll-area';

type Orientation = 'vertical' | 'horizontal' | 'both';

export type ScrollbarProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  orientation?: Orientation;
  autoHide?: boolean;
  onScroll?: UIEventHandler<HTMLDivElement>;
  'aria-label'?: string;
  /**
   * When true (default), vertical content gets min-height:100% so empty kanban
   * columns can fill the viewport. Set false for compact lists (e.g. projects)
   * so short content does not leave a large empty band under the last row.
   */
  stretchContent?: boolean;
};

const Scrollbar = forwardRef<HTMLDivElement, ScrollbarProps>(function Scrollbar(
  {
    children,
    className,
    style,
    orientation = 'vertical',
    autoHide = true,
    onScroll,
    'aria-label': ariaLabel,
    stretchContent = true,
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isMobile = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
  }, []);

  /* Horizontal areas: browser wheel is vertical - map it to scrollLeft. */
  useEffect(() => {
    if (isMobile) return;
    if (orientation !== 'horizontal' && orientation !== 'both') return;
    const root = rootRef.current;
    if (!root) return;

    const viewport = root.querySelector(
      '[data-radix-scroll-area-viewport]',
    ) as HTMLElement | null;
    if (!viewport) return;

    const onWheel = (e: WheelEvent) => {
      const dx = e.deltaX;
      const dy = e.deltaY;
      if (Math.abs(dx) > Math.abs(dy)) return;

      const max = viewport.scrollWidth - viewport.clientWidth;
      if (max <= 1) return;

      const before = viewport.scrollLeft;
      viewport.scrollLeft = Math.max(0, Math.min(max, before + dy));
      if (viewport.scrollLeft !== before) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [isMobile, orientation]);

  /*
   * Radix defaults the viewport child to display:table (horizontal blowout).
   * Optionally stretch to min-height:100% for kanban empty columns; keep off for
   * compact lists so short content does not leave empty space under the last row.
   */
  useEffect(() => {
    if (isMobile) return;
    if (orientation !== 'vertical') return;
    const root = rootRef.current;
    if (!root) return;
    const inner = root.querySelector(
      '[data-radix-scroll-area-viewport] > div',
    ) as HTMLElement | null;
    if (!inner) return;
    inner.style.setProperty('display', 'flex', 'important');
    inner.style.setProperty('flex-direction', 'column', 'important');
    if (stretchContent) {
      inner.style.setProperty('min-height', '100%', 'important');
    } else {
      inner.style.setProperty('min-height', '0', 'important');
    }
    inner.style.setProperty('min-width', '0', 'important');
    inner.style.setProperty('width', '100%', 'important');
    inner.style.setProperty('max-width', '100%', 'important');
    inner.style.setProperty('box-sizing', 'border-box', 'important');
  }, [isMobile, orientation, children, stretchContent]);

  if (isMobile) {
    return (
      <div
        ref={ref}
        role={ariaLabel ? 'region' : undefined}
        aria-label={ariaLabel}
        className={cn(
          'ui-scrollbar-mobile',
          orientation === 'horizontal' && 'ui-scrollbar-mobile--x',
          orientation === 'vertical' && 'ui-scrollbar-mobile--y',
          orientation === 'both' && 'ui-scrollbar-mobile--both',
          className,
        )}
        style={{ scrollBehavior: 'smooth', ...style }}
        onScroll={onScroll}
      >
        {children}
      </div>
    );
  }

  const viewportStyle: CSSProperties =
    orientation === 'vertical'
      ? { overflowX: 'hidden' }
      : orientation === 'horizontal'
        ? { overflowY: 'hidden' }
        : {};

  return (
    <ScrollAreaPrimitive.Root
      ref={rootRef}
      type={autoHide ? 'hover' : 'always'}
      className={cn(
        'ui-scroll-area',
        orientation === 'vertical' && 'ui-scroll-area--vertical',
        orientation === 'horizontal' && 'ui-scroll-area--horizontal',
        orientation === 'both' && 'ui-scroll-area--both',
        className,
      )}
      style={style}
    >
      <ScrollAreaPrimitive.Viewport
        className="ui-scroll-viewport"
        style={viewportStyle}
        onScroll={onScroll as UIEventHandler<HTMLDivElement>}
      >
        <div
          ref={ref}
          role={ariaLabel ? 'toolbar' : undefined}
          aria-label={ariaLabel}
          className={cn(
            orientation === 'horizontal' && 'ui-scrollbar-content--x',
            orientation === 'vertical' && 'ui-scrollbar-content--y',
            orientation === 'both' && 'ui-scrollbar-content--both',
          )}
        >
          {children}
        </div>
      </ScrollAreaPrimitive.Viewport>
      {(orientation === 'vertical' || orientation === 'both') && (
        <ScrollBar orientation="vertical" />
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollBar orientation="horizontal" />
      )}
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
});

Scrollbar.displayName = 'Scrollbar';

const ScrollbarMemo = memo(Scrollbar);
export { ScrollbarMemo as Scrollbar };
export default ScrollbarMemo;
