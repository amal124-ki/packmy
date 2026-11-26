'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Compass,
  LogOut,
  Menu,
  Moon,
  Plus,
  Shield,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, setUser, flashes, flash, dismissFlash, clearFlashes, theme, toggleTheme } =
    useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/';

  const navLinkClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      active
        ? 'bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50'
        : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100/70 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/60'
    }`;

  async function handleLogout() {
    clearFlashes();
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    flash('You have signed out.', 'info');
    router.push('/');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-[1000] h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-950/85 backdrop-blur-md">
        <nav className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <img
                src="/img/logo-full.png"
                alt="PackMY"
                className="h-8 w-8 object-contain rounded-md"
              />
              <span className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                PackMY
              </span>
            </Link>

            {/* Primary desktop links */}
            {user && (
              <div className="hidden md:flex items-center gap-1">
                {user.is_admin ? (
                  <>
                    <Link
                      href="/admin"
                      className={navLinkClass(pathname === '/admin')}
                    >
                      Admin Console
                    </Link>
                    <Link
                      href="/admin/assets"
                      className={navLinkClass(pathname.startsWith('/admin/assets'))}
                    >
                      Travel Assets
                    </Link>
                    <Link
                      href="/admin/users"
                      className={navLinkClass(pathname.startsWith('/admin/users'))}
                    >
                      Users
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/dashboard"
                      className={navLinkClass(pathname === '/dashboard' || pathname.startsWith('/trip/') && pathname !== '/trip/new')}
                    >
                      My Trips
                    </Link>
                    <Link
                      href="/profile"
                      className={navLinkClass(pathname === '/profile')}
                    >
                      Profile
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="btn-ghost !p-2"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {user ? (
              <>
                {user.is_admin ? (
                  <Link href="/admin" className="btn-secondary btn-sm">
                    <Shield className="h-3.5 w-3.5" />
                    Console
                  </Link>
                ) : (
                  <Link href="/trip/new" className="btn-accent btn-sm">
                    <Plus className="h-3.5 w-3.5" />
                    New Trip
                  </Link>
                )}

                <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />

                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 max-w-[140px] truncate">
                  {user.name}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn-ghost btn-sm text-zinc-500"
                  title="Sign out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/register" className="btn-primary btn-sm">
                  Create account
                </Link>
              </>
            )}
          </div>

          {/* Mobile controls */}
          <div className="flex md:hidden items-center gap-1">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="btn-ghost !p-2"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Toggle navigation menu"
              className="btn-ghost !p-2"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 py-3 space-y-1 shadow-lg">
            {user ? (
              <>
                <div className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 mb-1">
                  Signed in as <span className="font-medium text-zinc-800 dark:text-zinc-200">{user.email}</span>
                </div>
                {user.is_admin ? (
                  <>
                    <Link
                      href="/admin"
                      onClick={() => setMenuOpen(false)}
                      className={`block ${navLinkClass(pathname === '/admin')}`}
                    >
                      Admin Console
                    </Link>
                    <Link
                      href="/admin/assets"
                      onClick={() => setMenuOpen(false)}
                      className={`block ${navLinkClass(pathname.startsWith('/admin/assets'))}`}
                    >
                      Travel Assets
                    </Link>
                    <Link
                      href="/admin/users"
                      onClick={() => setMenuOpen(false)}
                      className={`block ${navLinkClass(pathname.startsWith('/admin/users'))}`}
                    >
                      Users
                    </Link>
                    <Link
                      href="/admin/settings"
                      onClick={() => setMenuOpen(false)}
                      className={`block ${navLinkClass(pathname.startsWith('/admin/settings'))}`}
                    >
                      ALNS Parameters
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2 ${navLinkClass(pathname === '/dashboard')}`}
                    >
                      <Compass className="h-4 w-4" />
                      My Trips
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2 ${navLinkClass(pathname === '/profile')}`}
                    >
                      <UserIcon className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link
                      href="/trip/new"
                      onClick={() => setMenuOpen(false)}
                      className="btn-accent w-full mt-2"
                    >
                      <Plus className="h-4 w-4" />
                      New Trip
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="btn-secondary w-full"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="btn-primary w-full"
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Flash alerts */}
      {flashes.length > 0 && (
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-4 space-y-2">
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

      <main className={isHome ? 'flex-1 w-full' : 'flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8'}>
        {children}
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-zinc-500 dark:text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PackMY · Malaysian Destination Recommendation and Itinerary Platform</span>
          <span>Powered by NLP, Fuzzy Logic, and ALNS Optimisation</span>
        </div>
      </footer>
    </div>
  );
}
