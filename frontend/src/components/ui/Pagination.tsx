'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
      <span>
        Showing <span className="font-medium text-zinc-700 dark:text-zinc-200">{start}</span> to{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{end}</span> of{' '}
        <span className="font-medium text-zinc-700 dark:text-zinc-200">{total}</span> results
      </span>
      <div className="flex items-center gap-2">
        <span>
          Page <span className="font-medium text-zinc-700 dark:text-zinc-200">{page}</span> of{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-200">{totalPages}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className="btn-secondary !p-1.5"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className="btn-secondary !p-1.5"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
