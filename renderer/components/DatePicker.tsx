'use client';

import { Icon, I } from '../lib/icons';
import { useEffect, useRef, useState } from 'react';
import {
  daysInMonth,
  formatDisplayDate,
  parseIsoDate,
  sameDay,
  startOfMonth,
  toIsoDate,
} from '../lib/format';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function DatePicker({
  value,
  today,
  onChange,
  onClose,
}: {
  value: string;
  today: string;
  onChange: (iso: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const selected = parseIsoDate(value);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const dim = daysInMonth(viewYear, viewMonth);
  const start = startOfMonth(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);

  return (
    <div className="date-picker" ref={ref} role="dialog" aria-label="Choose date">
      <div className="date-picker-header">
        <button type="button" className="icon-btn" onClick={prevMonth} aria-label="Previous month">
          <Icon icon={I.chevronLeft} width={16} />
        </button>
        <span className="date-picker-month">{monthLabel}</span>
        <button type="button" className="icon-btn" onClick={nextMonth} aria-label="Next month">
          <Icon icon={I.chevronRight} width={16} />
        </button>
      </div>
      <div className="date-picker-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="date-picker-grid">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e-${i}`} className="date-picker-empty" />;
          const iso = toIsoDate(new Date(viewYear, viewMonth, day));
          const isSelected = sameDay(iso, value);
          const isToday = sameDay(iso, today);
          const isFuture = iso > today;
          return (
            <button
              key={iso}
              type="button"
              className={`date-picker-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
              disabled={isFuture}
              onClick={() => {
                if (isFuture) return;
                onChange(iso);
                onClose();
              }}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="date-picker-footer">
        <button
          type="button"
          className="btn btn-today"
          onClick={() => {
            onChange(today);
            onClose();
          }}
        >
          <Icon icon={I.today} width={14} />
          Today
        </button>
        <span className="date-picker-selected">{formatDisplayDate(value)}</span>
      </div>
    </div>
  );
}
