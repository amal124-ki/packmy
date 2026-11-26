'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CheckCircle2, Loader2, SlidersHorizontal } from 'lucide-react';
import { UserProfile, useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface NlpResult {
  region?: string;
  days?: number;
  budget?: number;
  travellers?: number;
  pace?: string;
  interests?: string[];
}

const PIPELINE_STEPS = [
  'Parsing request parameters',
  'Scoring candidate attractions with fuzzy logic',
  'Optimising daily routes and schedules with ALNS',
];

function NewTripForm() {
  const { user, loadingAuth, flash, clearFlashes } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRegion = searchParams.get('region') || '';

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>([]);

  const [prompt, setPrompt] = useState('');
  const [region, setRegion] = useState(initialRegion);
  const [startDate, setStartDate] = useState('');
  const [days, setDays] = useState('3');
  const [budget, setBudget] = useState('1000');
  const [travellers, setTravellers] = useState('1');
  const [pace, setPace] = useState('normal');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const [nlpVisible, setNlpVisible] = useState(false);
  const [nlpItems, setNlpItems] = useState<[string, string | number][]>([]);
  const [error, setError] = useState('');

  const [generating, setGenerating] = useState(false);
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      const nextUrl = initialRegion
        ? `/trip/new?region=${encodeURIComponent(initialRegion)}`
        : '/trip/new';
      router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    apiFetch<{
      regions: string[];
      interests: string[];
      profile: UserProfile;
      default_date: string;
    }>('/api/trip/meta').then((res) => {
      if (res.status === 401) {
        router.replace('/login?next=/trip/new');
        return;
      }
      if (res.ok) {
        setRegions(res.data.regions || []);
        setAllInterests(res.data.interests || []);
        setStartDate(res.data.default_date || '');
        if (res.data.profile) {
          setBudget(String(res.data.profile.default_budget || 1000));
          setPace(res.data.profile.pace || 'normal');
          setSelectedInterests(res.data.profile.interests || []);
        }
        if (initialRegion) {
          setRegion(initialRegion);
        }
      }
      setLoadingMeta(false);
    });
  }, [loadingAuth, user, router, initialRegion]);

  function handlePromptChange(value: string) {
    setPrompt(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      if (!value.trim()) {
        setNlpVisible(false);
        return;
      }
      const res = await apiFetch<NlpResult>('/api/parse', {
        method: 'POST',
        body: JSON.stringify({ prompt: value }),
      });
      if (!res.ok) return;
      const last = res.data;
      const items: [string, string | number][] = [];
      if (last.region) items.push(['Region', last.region]);
      if (last.days) items.push(['Days', last.days]);
      if (last.budget) items.push(['Budget', 'RM' + last.budget.toLocaleString()]);
      if (last.travellers) items.push(['Travellers', last.travellers]);
      if (last.pace) items.push(['Pace', last.pace]);
      (last.interests || []).forEach((i) => items.push(['Interest', i]));
      setNlpItems(items);
      setNlpVisible(true);

      if (last.region) setRegion(last.region);
      if (last.days) setDays(String(Math.min(last.days, 7)));
      if (last.budget) setBudget(String(last.budget));
      if (last.travellers) setTravellers(String(last.travellers));
      if (last.pace) setPace(last.pace);
      if (last.interests && last.interests.length > 0) {
        setSelectedInterests((prev) => Array.from(new Set([...prev, ...last.interests!])));
      }
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function toggleInterest(val: string) {
    setSelectedInterests((prev) =>
      prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearFlashes();
    setError('');
    setGenerating(true);
    setLoadingStepIdx(0);
    const interval = setInterval(() => {
      setLoadingStepIdx((k) => Math.min(k + 1, 2));
    }, 650);

    const res = await apiFetch<{ trip_id?: number }>('/api/trips', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        region,
        start_date: startDate,
        days,
        budget,
        travellers,
        pace,
        interests: selectedInterests,
      }),
    });

    clearInterval(interval);
    setGenerating(false);

    if (!res.ok) {
      const msg = res.error || 'Unable to generate itinerary. Please review your trip parameters.';
      if (res.status === 422) {
        flash(msg, 'error');
        router.push('/dashboard');
      } else {
        setError(msg);
      }
      return;
    }

    router.push(`/trip/${res.data.trip_id}`);
  }

  if (loadingAuth || loadingMeta) {
    return <PageSkeleton />;
  }

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader
          title="New Trip Request"
          description="Describe your trip in plain language or configure structured parameters directly."
          backHref="/dashboard"
          backLabel="Back to My Trips"
        />

        {error && <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Natural Language Input */}
          <section className="surface p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  1. Trip Description
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Optional. Recognised details automatically populate the parameter fields below.
                </p>
              </div>
              <Badge variant="neutral">Optional</Badge>
            </div>

            <div className="mt-4">
              <textarea
                id="prompt"
                name="prompt"
                rows={3}
                className="input resize-none"
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Example: 3 days in Penang for 2 travellers, RM1,500 budget. Street food and heritage, relaxed pace."
              />
            </div>

            {nlpVisible && (
              <div className="mt-3 rounded-md border border-brand-200 dark:border-brand-900/70 bg-brand-50/70 dark:bg-brand-950/30 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-800 dark:text-brand-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Detected parameters
                  </span>
                  <span className="text-[11px] text-brand-700 dark:text-brand-400">
                    Fields updated below. You can still adjust any value.
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {nlpItems.length > 0 ? (
                    nlpItems.map(([k, v], idx) => (
                      <Badge key={`${k}-${v}-${idx}`} variant="brand">
                        {k}: {v}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400">
                      No structured parameters detected yet. Include a destination, duration, or
                      budget.
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Structured Parameters */}
          <section className="surface p-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-zinc-400" />
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                2. Trip Parameters
              </h2>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 mt-5">
              <div>
                <label className="label" htmlFor="region">
                  Destination
                </label>
                <select
                  className="input"
                  id="region"
                  name="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  <option value="">Detect from description</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="start_date">
                  Start date
                </label>
                <input
                  className="input"
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="days">
                  Duration (1–7 days)
                </label>
                <input
                  className="input"
                  type="number"
                  id="days"
                  name="days"
                  min={1}
                  max={7}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="budget">
                  Total budget (RM)
                </label>
                <input
                  className="input"
                  type="number"
                  id="budget"
                  name="budget"
                  min={50}
                  step={10}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="travellers">
                  Travellers
                </label>
                <input
                  className="input"
                  type="number"
                  id="travellers"
                  name="travellers"
                  min={1}
                  max={12}
                  value={travellers}
                  onChange={(e) => setTravellers(e.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="pace">
                  Daily pace
                </label>
                <select
                  className="input"
                  id="pace"
                  name="pace"
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                >
                  <option value="relaxed">Relaxed (up to 3 stops/day)</option>
                  <option value="normal">Normal (up to 4 stops/day)</option>
                  <option value="packed">Packed (up to 6 stops/day)</option>
                </select>
              </div>
            </div>

            <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
              <label className="label">Interests</label>
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
            <button disabled={generating} className="btn-accent px-5">
              Generate Itinerary
            </button>
          </div>
        </form>
      </div>

      {/* Progress dialog while running pipeline */}
      {generating && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-zinc-950/50 backdrop-blur-[2px] p-4">
          <div className="w-full max-w-sm rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600 dark:text-brand-400 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  Generating Itinerary
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Please wait while the schedule is calculated.
                </p>
              </div>
            </div>
            <div className="mt-5 space-y-2.5">
              {PIPELINE_STEPS.map((label, idx) => {
                const done = idx < loadingStepIdx;
                const current = idx === loadingStepIdx;
                return (
                  <div
                    key={label}
                    className={`flex items-center gap-2.5 text-xs ${
                      done
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : current
                        ? 'font-medium text-zinc-900 dark:text-zinc-100'
                        : 'text-zinc-400 dark:text-zinc-600'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                        done
                          ? 'bg-emerald-500'
                          : current
                          ? 'bg-brand-500'
                          : 'bg-zinc-300 dark:bg-zinc-700'
                      }`}
                    />
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function NewTripPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewTripForm />
    </Suspense>
  );
}
