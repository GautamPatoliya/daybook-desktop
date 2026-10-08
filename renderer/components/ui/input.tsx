'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Shadcn-style text input on Daybook tokens. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', type = 'text', ...props },
  ref,
) {
  return <input ref={ref} type={type} className={['ui-input', className].filter(Boolean).join(' ')} {...props} />;
});
