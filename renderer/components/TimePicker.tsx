'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hour24ToParts, partsToHour24, formatClock } from '../lib/time';
import { OverlayScroll } from './OverlayScroll';
import { Icon, I } from '../lib/icons';

type Props = {
  hour: number;
  minute?: number;
  showMinutes?: boolean;
  onChange: (next: { hour: number; minute: number }) => void;
  'aria-label'?: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimePicker({
  hour,
  minute = 0,
  showMinutes = false,
  onChange,
  'aria-label': ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{
    top: number | null;
    bottom: number | null;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const parts = hour24ToParts(hour, minute);
  const minuteRounded = minute - (minute % 5);
  const label = showMinutes
    ? formatClock(hour, minuteRounded)
    : `${parts.hour12}:00 ${parts.period}`;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setBox(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 12;
      const spaceAbove = rect.top - gap - 12;
      const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(280, Math.max(160, preferUp ? spaceAbove : spaceBelow));
      const width = Math.max(220, Math.floor(rect.width));
      let left = Math.floor(rect.left);
      left = Math.min(left, window.innerWidth - width - 12);
      left = Math.max(12, left);
      setBox({
        top: preferUp ? null : rect.bottom + gap,
        bottom: preferUp ? window.innerHeight - rect.top + gap : null,
        left,
        width,
        maxHeight,
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  function setHour12(h: number) {
    onChange({
      hour: partsToHour24(h, parts.period),
      minute: showMinutes ? minuteRounded : 0,
    });
  }

  function setMinute(m: number) {
    onChange({
      hour: partsToHour24(parts.hour12, parts.period),
      minute: m,
    });
  }

  function setPeriod(period: 'AM' | 'PM') {
    onChange({
      hour: partsToHour24(parts.hour12, period),
      minute: showMinutes ? minuteRounded : 0,
    });
  }

  const panel =
    open && box && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={panelRef}
            className="time-popover"
            role="dialog"
            aria-label={ariaLabel || 'Pick time'}
            style={{
              position: 'fixed',
              top: box.top ?? undefined,
              bottom: box.bottom ?? undefined,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
              zIndex: 520,
            }}
          >
            <div className="time-popover-period" role="group" aria-label="AM or PM">
              {(['AM', 'PM'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={parts.period === p ? 'on' : ''}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className={`time-popover-cols${showMinutes ? ' has-minutes' : ''}`}>
              <div className="time-popover-col">
                <span className="time-popover-col-label">Hour</span>
                <OverlayScroll className="time-popover-scroll" maxHeight={Math.min(200, box.maxHeight - 72)} autoHide>
                  <ul className="time-popover-list" role="listbox" aria-label="Hour">
                    {HOURS.map((h) => (
                      <li key={h}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={parts.hour12 === h}
                          className={parts.hour12 === h ? 'selected' : ''}
                          onClick={() => {
                            setHour12(h);
                            if (!showMinutes) setOpen(false);
                          }}
                        >
                          {h}
                        </button>
                      </li>
                    ))}
                  </ul>
                </OverlayScroll>
              </div>
              {showMinutes && (
                <div className="time-popover-col">
                  <span className="time-popover-col-label">Min</span>
                  <OverlayScroll className="time-popover-scroll" maxHeight={Math.min(200, box.maxHeight - 72)} autoHide>
                    <ul className="time-popover-list" role="listbox" aria-label="Minute">
                      {MINUTES.map((m) => (
                        <li key={m}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={minuteRounded === m}
                            className={minuteRounded === m ? 'selected' : ''}
                            onClick={() => {
                              setMinute(m);
                              setOpen(false);
                            }}
                          >
                            {String(m).padStart(2, '0')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </OverlayScroll>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="time-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`time-picker-trigger${open ? ' open' : ''}`}
        aria-label={ariaLabel || 'Time'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon icon={I.clock} width={16} className="time-picker-trigger-icon" />
        <span className="time-picker-trigger-value">{label}</span>
        <Icon
          icon={I.chevronDown}
          width={14}
          className={`time-picker-trigger-chevron${open ? ' open' : ''}`}
        />
      </button>
      {panel}
    </div>
  );
}
