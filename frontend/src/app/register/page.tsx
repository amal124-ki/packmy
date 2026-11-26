'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthUser, useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';

export default function RegisterPage() {
  const { user, loadingAuth, setUser, flash, clearFlashes } = useApp();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const res = await apiFetch<{ user: AuthUser; message?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, confirm }),
    });
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error || 'Unable to create account. Please try again.');
      return;
    }

    setUser(res.data.user);
    flash(
      res.data.message || 'Account created. Complete your travel profile to set default preferences.',
      'success'
    );
    router.push('/profile');
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
            Create an account
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Register to plan and manage your Malaysian travel itineraries.
          </p>
        </div>

        {error && (
          <div className="mb-4">
            <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input
              className="input"
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Alex Tan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

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
              autoComplete="new-password"
              minLength={6}
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="confirm">
              Confirm password
            </label>
            <input
              className="input"
              type="password"
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-5 text-center">
        Already have an account?{' '}
        <Link
          className="font-medium text-zinc-900 dark:text-zinc-100 underline underline-offset-4 hover:text-brand-600 dark:hover:text-brand-400"
          href="/login"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
