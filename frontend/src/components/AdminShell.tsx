'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  SlidersHorizontal,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';

const NAV_SECTIONS = [
  {
    label: 'Analytics',
    items: [{ href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'Management',
    items: [
      { href: '/admin/assets', label: 'Travel Assets', icon: MapPin, exact: false },
      { href: '/admin/users', label: 'Users', icon: Users, exact: false },
    ],
  },
  {
    label: 'Optimiser',
    items: [
      { href: '/admin/settings', label: 'ALNS Parameters', icon: SlidersHorizontal, exact: false },
    ],
  },
];

function getBreadcrumb(pathname: string) {
  if (pathname === '/admin') return 'Overview';
  if (pathname === '/admin/assets/new') return 'Travel Assets / New Asset';
  if (pathname.startsWith('/admin/assets/') && pathname.endsWith('/edit')) {
    return 'Travel Assets / Edit Asset';
  }
  if (pathname.startsWith('/admin/assets')) return 'Travel Assets';
  if (pathname.startsWith('/admin/users')) return 'Users';
  if (pathname.startsWith('/admin/settings')) return 'ALNS Parameters';
  return 'Admin';
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, setUser, flashes, flash, dismissFlash, clearFlashes, theme, toggleTheme } =
    useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    clearFlashes();
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    flash('You have signed out.', 'info');
    router.push('/');
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800">
      <div className="h-14 px-4 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/admin" className="flex items-center gap-2.5">
          <img
            src="/img/logo-full.png"
            alt="PackMY"
            className="h-7 w-7 object-contain rounded-md"
          />
          <div className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              PackMY
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-400">
              Admin Console
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden btn-ghost !p-1.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800/90 dark:text-zinc-50'
                        : 'text-zinc-600 hover:bg-zinc-100/70 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active
                          ? 'text-brand-600 dark:text-brand-400'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
        <Link
          href="/"
          className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900 transition-colors"
        >
          <span>View public site</span>
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>

        {user && (
          <div className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 px-2.5 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {user.name}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-60 shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile slide-over sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-zinc-950/50 backdrop-blur-[1px]"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        <header className="sticky top-0 z-20 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden btn-ghost !p-1.5"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-zinc-400 dark:text-zinc-500 hidden sm:inline">Admin</span>
              <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">/</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {getBreadcrumb(pathname)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="btn-ghost !p-2"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {flashes.length > 0 && (
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 space-y-2">
            {flashes.map((f) => (
              <AlertBanner
                key={f.id}
                variant={f.category}
                message={f.message}
                onDismiss={() => dismissFlash(f.id)}
              />
            ))}
          </div>
        )}

        <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
