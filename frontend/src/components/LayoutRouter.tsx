'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { AppShell } from '@/components/AppShell';
import { AdminShell } from '@/components/AdminShell';

export function LayoutRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { flashes, clearFlashes } = useApp();
  const prevPathRef = useRef(pathname);
  const clearNextNavRef = useRef(false);

  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      if (clearNextNavRef.current) {
        clearFlashes();
        clearNextNavRef.current = false;
      } else if (flashes.length > 0) {
        clearNextNavRef.current = true;
      }
    }
  }, [pathname, flashes.length, clearFlashes]);

  useEffect(() => {
    if (flashes.length > 0) {
      clearNextNavRef.current = true;
    }
  }, [flashes]);

  if (pathname.startsWith('/admin')) {
    return <AdminShell>{children}</AdminShell>;
  }

  return <AppShell>{children}</AppShell>;
}
