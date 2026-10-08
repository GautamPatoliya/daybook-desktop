'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, I } from '../lib/icons';
import {
  filterEmailSuggestions,
  isPlausibleEmail,
  parseEmailList,
  serializeEmailList,
} from '../lib/emailRecipients';

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  suggestions?: string[];
  onCommitEmail?: (email: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function EmailChipInput({
  id,
  value,
  onChange,
  suggestions = [],
  onCommitEmail,
  placeholder = 'type an email…',
  disabled,
}: Props) {
  const chips = useMemo(() => parseEmailList(value), [value]);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [menuBox, setMenuBox] = useState<{
    top: number | null;
    bottom: number | null;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterEmailSuggestions(suggestions, draft, chips),
    [suggestions, draft, chips],
  );

  const trimmed = draft.trim();
  const canAddDraft =
    Boolean(trimmed) &&
    isPlausibleEmail(trimmed) &&
    !chips.some((c) => c.toLowerCase() === trimmed.toLowerCase());
  const showAddRow =
    Boolean(trimmed) &&
    canAddDraft &&
    !filtered.some((f) => f.toLowerCase() === trimmed.toLowerCase());

  const menuItems = useMemo(() => {
    const items: { kind: 'suggestion' | 'add'; value: string; label: string }[] = filtered.map(
      (email) => ({ kind: 'suggestion' as const, value: email, label: email }),
    );
    if (showAddRow) {
      items.push({ kind: 'add', value: trimmed, label: `Add ${trimmed}` });
    }
    return items;
  }, [filtered, showAddRow, trimmed]);

  useEffect(() => {
    if (!open) return;
    setHighlight((h) => Math.min(h, Math.max(0, menuItems.length - 1)));
  }, [menuItems.length, open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current || menuItems.length === 0) {
      setMenuBox(null);
      return;
    }
    const place = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      const gap = 6;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const preferUp = spaceBelow < 160 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(220, Math.max(120, preferUp ? spaceAbove : spaceBelow));
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
  }, [open, menuItems.length, chips.length, draft]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function emit(nextChips: string[]) {
    onChange(serializeEmailList(nextChips));
  }

  function commitEmail(raw: string) {
    const email = raw.trim();
    if (!email) return false;
    if (!isPlausibleEmail(email)) {
      setHint('Enter a valid email like name@company.com');
      return false;
    }
    if (chips.some((c) => c.toLowerCase() === email.toLowerCase())) {
      setDraft('');
      setHint(null);
      setOpen(false);
      return true;
    }
    emit([...chips, email]);
    onCommitEmail?.(email);
    setDraft('');
    setHint(null);
    setOpen(false);
    setHighlight(0);
    return true;
  }

  function removeAt(index: number) {
    emit(chips.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && menuItems.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % menuItems.length);
      return;
    }
    if (e.key === 'ArrowUp' && menuItems.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + menuItems.length) % menuItems.length);
      return;
    }
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (open && menuItems[highlight]) {
        // Enter keeps focus; Tab commits then lets focus move on
        if (e.key === 'Enter') e.preventDefault();
        commitEmail(menuItems[highlight].value);
        return;
      }
      if (trimmed) {
        if (e.key === 'Enter') e.preventDefault();
        commitEmail(trimmed);
      }
      return;
    }
    if (e.key === 'Backspace' && !draft && chips.length) {
      e.preventDefault();
      removeAt(chips.length - 1);
      return;
    }
    if (e.key === ',' || e.key === ';') {
      e.preventDefault();
      if (trimmed) commitEmail(trimmed);
    }
  }

  function onDraftChange(next: string) {
    if (/[,;]/.test(next)) {
      const parts = next.split(/[,;]+/);
      const head = parts.slice(0, -1);
      const tail = parts[parts.length - 1] ?? '';
      let list = [...chips];
      for (const part of head) {
        const email = part.trim();
        if (!email || !isPlausibleEmail(email)) continue;
        if (list.some((c) => c.toLowerCase() === email.toLowerCase())) continue;
        list = [...list, email];
        onCommitEmail?.(email);
      }
      emit(list);
      setDraft(tail);
      setHint(null);
      setOpen(true);
      return;
    }
    setDraft(next);
    setHint(null);
    setOpen(true);
    setHighlight(0);
  }

  const menu =
    open && focused && menuBox && menuItems.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="email-chip-menu"
            style={{
              position: 'fixed',
              top: menuBox.top ?? undefined,
              bottom: menuBox.bottom ?? undefined,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
              zIndex: 520,
            }}
            role="listbox"
            id={id ? `${id}-listbox` : undefined}
          >
            <ul className="email-chip-menu-list">
              {menuItems.map((item, idx) => (
                <li key={`${item.kind}-${item.value}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === highlight}
                    className={`email-chip-option${idx === highlight ? ' is-active' : ''}${
                      item.kind === 'add' ? ' is-add' : ''
                    }`}
                    onMouseEnter={() => setHighlight(idx)}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      commitEmail(item.value);
                    }}
                  >
                    <Icon
                      icon={item.kind === 'add' ? I.plus : I.mail}
                      width={15}
                      className="email-chip-option-icon"
                    />
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`email-chip-field${disabled ? ' is-disabled' : ''}`}>
      <div
        ref={rootRef}
        className={`email-chip-shell${focused ? ' is-focused' : ''}${hint ? ' has-hint' : ''}`}
        onClick={() => {
          if (disabled) return;
          inputRef.current?.focus();
        }}
      >
        {chips.map((email, index) => (
          <span
            key={`${email}-${index}`}
            className={`email-chip${isPlausibleEmail(email) ? '' : ' is-invalid'}`}
          >
            <span className="email-chip-text" title={email}>
              {email}
            </span>
            <button
              type="button"
              className="email-chip-dismiss"
              aria-label={`Remove ${email}`}
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                removeAt(index);
              }}
            >
              <Icon icon={I.close} width={14} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          className="email-chip-input"
          value={draft}
          disabled={disabled}
          placeholder={chips.length ? '' : placeholder}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open && menuItems.length > 0}
          aria-controls={id ? `${id}-listbox` : undefined}
          aria-autocomplete="list"
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => {
            setFocused(false);
            if (trimmed) commitEmail(trimmed);
            else setHint(null);
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      {hint ? <p className="email-chip-hint">{hint}</p> : null}
      {menu}
    </div>
  );
}
