'use client';

import type { ReactNode } from 'react';

type ToggleSwitchProps = {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: ReactNode;
  warning?: ReactNode;
};

/** Accessible switch control — no native checkbox chrome. */
export function ToggleSwitch({ id, checked, onChange, label, description, warning }: ToggleSwitchProps) {
  return (
    <div className={`settings-switch-row${checked ? ' is-on' : ''}`}>
      <div className="settings-switch-copy">
        <label htmlFor={id} className="settings-switch-label">
          {label}
        </label>
        {description ? <p className="settings-switch-desc">{description}</p> : null}
        {warning ? <div className="settings-switch-warn">{warning}</div> : null}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className={`ui-switch${checked ? ' is-on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="ui-switch-thumb" />
      </button>
    </div>
  );
}
