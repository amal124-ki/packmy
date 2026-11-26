'use client';

import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const STYLES: Record<AlertVariant, string> = {
  success:
    'bg-emerald-50/90 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/70',
  error:
    'bg-red-50/90 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/70',
  warning:
    'bg-amber-50/90 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/70',
  info: 'bg-sky-50/90 text-sky-900 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/70',
};

const ICON_STYLES: Record<AlertVariant, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  error: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
};

export function AlertBanner({
  variant = 'info',
  message,
  onDismiss,
  action,
}: {
  variant?: AlertVariant;
  message: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
}) {
  const Icon =
    variant === 'success'
      ? CheckCircle2
      : variant === 'error'
      ? AlertCircle
      : variant === 'warning'
      ? AlertTriangle
      : Info;

  return (
    <div
      role="status"
      className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${STYLES[variant]}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${ICON_STYLES[variant]}`} />
        <div className="leading-snug">{message}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss notification"
            className="rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
