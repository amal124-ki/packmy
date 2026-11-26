import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/80 ${className}`}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface p-4 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      <div className="surface p-5 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
