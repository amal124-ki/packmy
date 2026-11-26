'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthUser, useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';

function LoginForm() {
  const { user, loadingAuth, setUser, clearFlashes } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loadingAuth && user) {
      router.replace(user.is_admin ? '/admin' : '/dashboard');
    }
  }, [user, loadingAuth, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearFlashes();
    setError('');
    setSubmitting(true);
    const res = await apiFetch<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember }),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Invalid email address or password.');
      return;
    }

    setUser(res.data.user);
    const nxt = searchParams.get('next');
    if (nxt && nxt.startsWith('/')) {
      router.push(nxt);
    } else {
      router.push(res.data.user.is_admin ? '/admin' : '/dashboard');
    }
  }

  return (
    <div className="max-w-sm mx-auto pt-6 sm:pt-12">
      <div className="surface p-6 sm:p-8">
        <div className="mb-6">
          <img
            src="/img/logo-full.png"
            alt="PackMY"
            className="h-10 w-10 object-contain rounded-md mb-4"
          />
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Sign in to PackMY
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Enter your account credentials to continue.
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email address
            </label>
            <input
              className="input"
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="input"
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 select-none">
            <input
              type="checkbox"
              name="remember"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700 accent-brand-600"
            />
            Keep me signed in
          </label>

          <button disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-5 text-center">
        Do not have an account?{' '}
        <Link
          className="font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:text-brand-600 dark:hover:text-brand-400"
          href="/register"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
