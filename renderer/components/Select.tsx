'use client';

import { Icon, I } from '../lib/icons';
import { useEffect, useRef, useState } from 'react';

export function Select({
  value,
  onChange,
  options,
  label,
  icon,
  compact,
  allowAdd,
  onRequestAdd,
  addLabel = 'Add new…',
  disabled,
  openUp,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label?: string;
  icon?: string;
  compact?: boolean;
  allowAdd?: boolean;
  onRequestAdd?: () => void;
  addLabel?: string;
  disabled?: boolean;
  openUp?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div className={`ui-select${compact ? ' compact' : ''}`} ref={ref}>
      {label && <span className="ui-select-label">{label}</span>}
      <button
        type="button"
        className={`ui-select-trigger${open ? ' open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
      >
        {icon && <Icon icon={icon} className="ui-select-icon" width={16} />}
        <span className="ui-select-value">{selected?.label ?? value}</span>
        <Icon
          icon={I.chevronDown}
          className={`ui-select-chevron${open ? ' open' : ''}`}
          width={14}
        />
      </button>
      {open && (
        <ul
          className="ui-select-menu"
          role="listbox"
          style={openUp ? { bottom: 'calc(100% + 4px)', top: 'auto' } : undefined}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={`ui-select-option${o.value === value ? ' selected' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.value === value && (
                  <Icon icon={I.selectCheck} width={14} className="ui-select-check" />
                )}
                <span>{o.label}</span>
              </button>
            </li>
          ))}
          {allowAdd && onRequestAdd && (
            <li className="ui-select-add">
              <button
                type="button"
                className="ui-select-option add"
                onClick={() => {
                  setOpen(false);
                  onRequestAdd();
                }}
              >
                <Icon icon={I.plus} width={14} />
                <span>{addLabel}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
