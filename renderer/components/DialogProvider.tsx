'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Icon, I } from '../lib/icons';
import { Input } from './ui/input';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = destructive delete; warning = caution; default = neutral */
  variant?: 'danger' | 'warning' | 'default';
};

export type PromptOptions = {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return ctx;
}

type ConfirmState = ConfirmOptions & { kind: 'confirm' };
type PromptState = PromptOptions & { kind: 'prompt'; value: string };
type State = ConfirmState | PromptState | null;

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(null);
  const resolver = useRef<((v: boolean | string | null) => void) | null>(null);

  const finish = useCallback((value: boolean | string | null) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    r?.(value);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = (v) => resolve(Boolean(v));
      setState({ kind: 'confirm', ...opts });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      resolver.current = (v) => resolve(typeof v === 'string' ? v : null);
      setState({
        kind: 'prompt',
        ...opts,
        value: opts.defaultValue ?? '',
      });
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {state && (
        <AppDialog
          state={state}
          onCancel={() => finish(state.kind === 'prompt' ? null : false)}
          onConfirm={() => {
            if (state.kind === 'prompt') finish(state.value);
            else finish(true);
          }}
          onPromptChange={(value) =>
            setState((s) => (s?.kind === 'prompt' ? { ...s, value } : s))
          }
        />
      )}
    </DialogContext.Provider>
  );
}

function AppDialog({
  state,
  onCancel,
  onConfirm,
  onPromptChange,
}: {
  state: ConfirmState | PromptState;
  onCancel: () => void;
  onConfirm: () => void;
  onPromptChange: (v: string) => void;
}) {
  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const variant = state.kind === 'confirm' ? state.variant || 'danger' : 'default';

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (state.kind === 'prompt') inputRef.current?.focus();
      else confirmRef.current?.focus();
    }, 20);
    return () => window.clearTimeout(t);
  }, [state.kind]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && state.kind === 'confirm') {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm, state.kind]);

  const icon =
    variant === 'danger' ? I.trash : variant === 'warning' ? I.warning : I.sparkles;
  const confirmLabel =
    state.confirmLabel ||
    (state.kind === 'prompt' ? 'Save' : variant === 'danger' ? 'Delete' : 'Continue');
  const cancelLabel = state.cancelLabel || 'Cancel';

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="overlay app-dialog-overlay" onClick={onCancel} />
      <div
        className={`composer app-dialog app-dialog--${variant}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <header className="composer-header app-dialog-header">
          <div className="app-dialog-title-row">
            <span className={`app-dialog-icon app-dialog-icon--${variant}`} aria-hidden>
              <Icon icon={icon} width={18} />
            </span>
            <strong id={titleId}>{state.title}</strong>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onCancel}>
            <Icon icon={I.close} width={16} />
          </button>
        </header>
        <div className="composer-body app-dialog-body">
          {state.message ? (
            <p id={descId} className="app-dialog-message">
              {state.message}
            </p>
          ) : (
            <span id={descId} className="sr-only">
              {state.title}
            </span>
          )}
          {state.kind === 'prompt' && (
            <Input
              ref={inputRef}
              value={state.value}
              placeholder={state.placeholder}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onConfirm();
                }
              }}
              aria-label={state.title}
            />
          )}
        </div>
        <footer className="composer-footer app-dialog-footer">
          <button type="button" className="btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={variant === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </>,
    document.body,
  );
}
