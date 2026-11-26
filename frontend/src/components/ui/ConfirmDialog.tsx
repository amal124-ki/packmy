'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-zinc-950/50 backdrop-blur-[2px] p-4"
      onClick={() => {
        if (!loading) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="flex items-start gap-3">
            {variant === 'danger' && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            )}
            <div>
              <h3
                id="confirm-dialog-title"
                className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
              >
                {title}
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 px-5 py-3 rounded-b-lg">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="btn-secondary btn-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={variant === 'danger' ? 'btn-danger-solid btn-sm' : 'btn-primary btn-sm'}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
