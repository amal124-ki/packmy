'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { AuthUser, UserProfile, useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

const TRAVEL_STYLES = [
  ['budget', 'Budget (lower meal allowance)'],
  ['moderate', 'Moderate'],
  ['luxury', 'Luxury'],
] as const;

const PACES = [
  ['relaxed', 'Relaxed (up to 3 stops/day)'],
  ['normal', 'Normal (up to 4 stops/day)'],
  ['packed', 'Packed (up to 6 stops/day)'],
] as const;

export default function ProfilePage() {
  const { user, loadingAuth, setUser, flash, clearFlashes } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [homeState, setHomeState] = useState('');
  const [travelStyle, setTravelStyle] = useState('moderate');
  const [pace, setPace] = useState('normal');
  const [defaultBudget, setDefaultBudget] = useState('1000');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>([]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.replace('/login?next=/profile');
      return;
    }
    apiFetch<{ user: AuthUser; profile: UserProfile; interests: string[] }>('/api/profile').then(
      (res) => {
        if (res.status === 401) {
          router.replace('/login?next=/profile');
          return;
        }
        if (res.ok) {
          setName(res.data.user.name);
          setHomeState(res.data.profile.home_state || '');
          setTravelStyle(res.data.profile.travel_style || 'moderate');
          setPace(res.data.profile.pace || 'normal');
          setDefaultBudget(String(res.data.profile.default_budget || 1000));
          setSelectedInterests(res.data.profile.interests || []);
          setAllInterests(res.data.interests || []);
        }
        setLoading(false);
      }
    );
  }, [loadingAuth, user, router]);

  function toggleInterest(val: string) {
    setSelectedInterests((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearFlashes();
    setError('');
    setSaving(true);
    const res = await apiFetch<{ user: AuthUser; message?: string }>('/api/profile', {
      method: 'POST',
      body: JSON.stringify({
        name,
        home_state: homeState,
        travel_style: travelStyle,
        pace,
        default_budget: Number(defaultBudget) || 1000,
        interests: selectedInterests,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      setError(res.error || 'Unable to save profile changes.');
      return;
    }
    setUser(res.data.user);
    flash(res.data.message || 'Profile preferences saved.', 'success');
    router.push('/dashboard');
  }

  if (loadingAuth || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Travel Profile"
        description="Manage account details and default planning preferences."
        backHref="/dashboard"
        backLabel="Back to My Trips"
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Account Details */}
        <section className="surface p-6">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Account Information
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Basic identity information linked to your account.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div>
              <label className="label" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                className="input"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="home_state">
                Home state
              </label>
              <input
                id="home_state"
                className="input"
                name="home_state"
                value={homeState}
                onChange={(e) => setHomeState(e.target.value)}
                placeholder="e.g. Melaka"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Default Preferences */}
        <section className="surface p-6">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Default Trip Preferences
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Applied automatically when creating a new trip request.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mt-5">
            <div>
              <label className="label" htmlFor="travel_style">
                Travel style
              </label>
              <select
                id="travel_style"
                className="input"
                name="travel_style"
                value={travelStyle}
                onChange={(e) => setTravelStyle(e.target.value)}
              >
                {TRAVEL_STYLES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pace">
                Daily pace
              </label>
              <select
                id="pace"
                className="input"
                name="pace"
                value={pace}
                onChange={(e) => setPace(e.target.value)}
              >
                {PACES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="default_budget">
                Typical budget (RM)
              </label>
              <input
                id="default_budget"
                className="input"
                type="number"
                min={50}
                step={50}
                name="default_budget"
                value={defaultBudget}
                onChange={(e) => setDefaultBudget(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
            <label className="label">Preferred interests</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {allInterests.map((i) => {
                const active = selectedInterests.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleInterest(i)}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-600'
                        : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {i.charAt(0).toUpperCase() + i.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link href="/dashboard" className="btn-secondary">
            Cancel
          </Link>
          <button disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
