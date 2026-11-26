import React from 'react';

type BadgeVariant = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral:
    'bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  brand:
    'bg-brand-50 text-brand-700 ring-brand-200 dark:bg-brand-950/60 dark:text-brand-300 dark:ring-brand-800/60',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/60',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/60',
  danger:
    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/60',
  info: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-800/60',
};

const DOTS: Record<BadgeVariant, string> = {
  neutral: 'bg-zinc-400',
  brand: 'bg-brand-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-sky-500',
};

export function Badge({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${VARIANTS[variant]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOTS[variant]}`} />}
      {children}
    </span>
  );
}
