'use client';

import { Icon, I } from '../lib/icons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { OverlayScroll } from './OverlayScroll';

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
  const [menuBox, setMenuBox] = useState<{
    top: number | null;
    bottom: number | null;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setMenuBox(null);
      return;
    }
    const place = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const preferUp = Boolean(openUp) || (spaceBelow < 160 && spaceAbove > spaceBelow);
      const maxHeight = Math.min(240, Math.max(120, preferUp ? spaceAbove : spaceBelow));
      setMenuBox({
        top: preferUp ? null : rect.bottom + gap,
        bottom: preferUp ? window.innerHeight - rect.top + gap : null,
        left: rect.left,
        width: Math.max(0, Math.floor(rect.width)),
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
  }, [open, openUp, options.length]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || menuRef.current?.contains(t)) return;
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

  const menu =
    open && menuBox && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="ui-select-menu ui-select-menu-portal"
            style={{
              position: 'fixed',
              top: menuBox.top ?? undefined,
              bottom: menuBox.bottom ?? undefined,
              left: menuBox.left,
              width: menuBox.width,
              maxWidth: menuBox.width,
              minWidth: 0,
              maxHeight: menuBox.maxHeight,
              /* height grows with content; maxHeight caps it */
              height: 'auto',
              zIndex: 500,
              overflow: 'hidden',
            }}
          >
            <OverlayScroll
              className="ui-select-menu-scroll"
              maxHeight={menuBox.maxHeight}
              autoHide
            >
              <ul className="ui-select-menu-list" role="listbox">
                {options.map((o) => (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.value === value}
                      title={o.label}
                      className={`ui-select-option${o.value === value ? ' selected' : ''}`}
                      onClick={() => {
                        onChange(o.value);
                        setOpen(false);
                      }}
                    >
                      {o.value === value ? (
                        <Icon icon={I.selectCheck} width={14} className="ui-select-check" />
                      ) : (
                        <span className="ui-select-check-spacer" aria-hidden />
                      )}
                      <span className="ui-select-option-label">{o.label}</span>
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
                      <span className="ui-select-option-label">{addLabel}</span>
                    </button>
                  </li>
                )}
              </ul>
            </OverlayScroll>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`ui-select${compact ? ' compact' : ''}`} ref={ref}>
      {label && <span className="ui-select-label">{label}</span>}
      <button
        ref={triggerRef}
        type="button"
        className={`ui-select-trigger${open ? ' open' : ''}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={selected?.label ?? value}
      >
        {icon && <Icon icon={icon} className="ui-select-icon" width={16} />}
        <span className="ui-select-value">{selected?.label ?? value}</span>
        <Icon
          icon={I.chevronDown}
          className={`ui-select-chevron${open ? ' open' : ''}`}
          width={14}
        />
      </button>
      {menu}
    </div>
  );
}
