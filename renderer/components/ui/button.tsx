'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'default' | 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'default' | 'sm' | 'icon';

const variantClass: Record<Variant, string> = {
  default: 'ui-btn',
  primary: 'ui-btn ui-btn-primary',
  ghost: 'ui-btn ui-btn-ghost',
  outline: 'ui-btn ui-btn-outline',
  danger: 'ui-btn ui-btn-danger',
};

const sizeClass: Record<Size, string> = {
  default: '',
  sm: 'ui-btn-sm',
  icon: 'ui-btn-icon',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

/** Shadcn-style button built on Daybook design tokens (no Tailwind required). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className = '', variant = 'default', size = 'default', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[variantClass[variant], sizeClass[size], className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});
