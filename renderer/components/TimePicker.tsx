'use client';

import { hour24ToParts, partsToHour24 } from '../lib/time';
import { Select } from './Select';

type Props = {
  hour: number;
  minute?: number;
  showMinutes?: boolean;
  onChange: (next: { hour: number; minute: number }) => void;
  'aria-label'?: string;
};

const HOURS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => ({
  value: String(m),
  label: String(m).padStart(2, '0'),
}));

export function TimePicker({
  hour,
  minute = 0,
  showMinutes = false,
  onChange,
  'aria-label': ariaLabel,
}: Props) {
  const parts = hour24ToParts(hour, minute);
  const minuteRounded = minute - (minute % 5);

  return (
    <div className="time-picker" role="group" aria-label={ariaLabel || 'Time'}>
      <div style={{ width: 72 }}>
        <Select
          value={String(parts.hour12)}
          onChange={(v) =>
            onChange({
              hour: partsToHour24(Number(v), parts.period),
              minute: parts.minute,
            })
          }
          options={HOURS}
          compact
          openUp
        />
      </div>
      {showMinutes ? (
        <>
          <span className="time-picker-sep">:</span>
          <div style={{ width: 78 }}>
            <Select
              value={String(minuteRounded)}
              onChange={(v) =>
                onChange({
                  hour: partsToHour24(parts.hour12, parts.period),
                  minute: Number(v),
                })
              }
              options={MINUTES}
              compact
              openUp
            />
          </div>
        </>
      ) : null}
      <div className="time-period" role="group" aria-label="AM or PM">
        <button
          type="button"
          className={parts.period === 'AM' ? 'on' : ''}
          onClick={() =>
            onChange({
              hour: partsToHour24(parts.hour12, 'AM'),
              minute: parts.minute,
            })
          }
        >
          AM
        </button>
        <button
          type="button"
          className={parts.period === 'PM' ? 'on' : ''}
          onClick={() =>
            onChange({
              hour: partsToHour24(parts.hour12, 'PM'),
              minute: parts.minute,
            })
          }
        >
          PM
        </button>
      </div>
    </div>
  );
}
