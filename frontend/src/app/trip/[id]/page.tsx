'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import Chart from 'chart.js/auto';
import {
  Building2,
  Car,
  ChevronDown,
  Clock,
  Download,
  RefreshCw,
  Star,
  Ticket,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { DAY_COLORS, type MapData } from '@/components/ItineraryMap';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

const ItineraryMap = dynamic(() => import('@/components/ItineraryMap'), { ssr: false });

const CAT_COLORS: Record<string, string> = {
  Accommodation: '#0d9488',
  Food: '#d97706',
  Attractions: '#2563eb',
  Transport: '#71717a',
};

interface Segment {
  id: number;
  day_no: number;
  order_no: number;
  arrive_time: string;
  depart_time: string;
  travel_km: number;
  cost: number;
  suitability: number;
  asset: {
    id: number;
    name: string;
    category: string;
    description: string;
    open_time: string;
    close_time: string;
    latitude: number;
    longitude: number;
  };
}

interface TripDetailPayload {
  trip: {
    id: number;
    region: string;
    days: number;
    budget: number;
    travellers: number;
    status: string;
    date_range: string;
    day_dates: string[];
  };
  itinerary: {
    id: number;
    title: string;
    total_cost: number;
    total_distance_km: number;
    summary_text: string;
    places_count: number;
    accommodation: { name: string } | null;
    days: Record<string, Segment[]>;
    expenses: {
      id: number;
      day_no: number;
      category: string;
      description: string;
      amount: number;
    }[];
    metrics: {
      iterations: number;
      runtime_ms: number;
      candidates: number;
      initial_objective: number;
      best_objective: number;
      improvement_pct: number;
    } | null;
  };
  by_cat: Record<string, number>;
  by_day: number[];
  map_data: MapData;
  parsed: { nlp_found?: Record<string, string | number | string[]> };
}

export default function TripItineraryPage() {
  const params = useParams<{ id: string }>();
  const tripId = params.id;
  const { user, loadingAuth, flash, clearFlashes, theme } = useApp();
  const router = useRouter();

  const [payload, setPayload] = useState<TripDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string>('all');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const catCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadTrip = useCallback(async () => {
    const res = await apiFetch<TripDetailPayload>(`/api/trips/${tripId}`);
    if (res.status === 401) {
      router.replace(`/login?next=/trip/${tripId}`);
      return;
    }
    if (!res.ok) {
      flash(res.error || 'This trip does not have an itinerary yet.', 'info');
      router.replace('/dashboard');
      return;
    }
    setPayload(res.data);
    setLoading(false);
  }, [tripId, router, flash]);

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.replace(`/login?next=/trip/${tripId}`);
      } else {
        loadTrip();
      }
    }
  }, [loadingAuth, user, router, tripId, loadTrip]);

  // Theme-aware Chart.js charts
  useEffect(() => {
    if (!payload || !catCanvasRef.current || !dayCanvasRef.current) return;

    const isDark = theme === 'dark';
    const textColor = isDark ? '#a1a1aa' : '#52525b';
    const gridColor = isDark ? '#27272a' : '#f4f4f5';
    const borderColor = isDark ? '#18181b' : '#ffffff';

    const catChart = new Chart(catCanvasRef.current, {
      type: 'doughnut',
      data: {
        labels: Object.keys(payload.by_cat),
        datasets: [
          {
            data: Object.values(payload.by_cat),
            backgroundColor: Object.keys(payload.by_cat).map((k) => CAT_COLORS[k] || '#a1a1aa'),
            borderColor,
            borderWidth: 2,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textColor,
              boxWidth: 10,
              padding: 12,
              font: { size: 12, family: 'Inter, system-ui, sans-serif' },
            },
          },
          tooltip: {
            callbacks: {
              label: (c) =>
                ` ${c.label}: RM${Number(c.parsed).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`,
            },
          },
        },
      },
    });

    const dayChart = new Chart(dayCanvasRef.current, {
      type: 'bar',
      data: {
        labels: payload.by_day.map((_, i) => `Day ${i + 1}`),
        datasets: [
          {
            label: 'Daily spend excl. hotel (RM)',
            data: payload.by_day,
            backgroundColor: '#0d9488',
            borderRadius: 4,
            maxBarThickness: 32,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: textColor,
              boxWidth: 10,
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            beginAtZero: true,
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
          },
        },
      },
    });

    return () => {
      catChart.destroy();
      dayChart.destroy();
    };
  }, [payload, theme]);

  async function handleRegenerate() {
    clearFlashes();
    setRegenerating(true);
    const res = await apiFetch<{ message?: string }>(`/api/trips/${tripId}/regenerate`, {
      method: 'POST',
    });
    setRegenerating(false);
    setConfirmRegen(false);
    if (!res.ok) {
      flash(res.error || 'Unable to regenerate itinerary.', 'error');
      router.push('/dashboard');
      return;
    }
    flash(res.data.message || 'Itinerary regenerated.', 'success');
    setActiveDay('all');
    loadTrip();
  }

  if (loadingAuth || loading || !payload) {
    return <PageSkeleton />;
  }

  const { trip, itinerary: it, parsed } = payload;
  const pct = trip.budget ? (it.total_cost / trip.budget) * 100 : 0;
  const dayNumbers = Array.from({ length: trip.days }, (_, idx) => idx + 1);
  const nlpEntries = Object.entries(parsed?.nlp_found || {});

  return (
    <div className="space-y-6">
      <PageHeader
        title={it.title}
        backHref={user?.is_admin ? '/admin' : '/dashboard'}
        backLabel={user?.is_admin ? 'Back to Admin Overview' : 'Back to My Trips'}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{trip.date_range}</span>
            <span>·</span>
            <span>
              {trip.travellers} traveller{trip.travellers > 1 ? 's' : ''}
            </span>
            {it.accommodation && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300 font-medium">
                  <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                  {it.accommodation.name}
                </span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => setConfirmRegen(true)}
              disabled={regenerating}
              className="btn-secondary"
            >
              <RefreshCw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              Regenerate
            </button>
            <a href={`/api/trips/${trip.id}/pdf`} className="btn-primary">
              <Download className="h-4 w-4" />
              Export PDF
            </a>
          </>
        }
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Estimated Cost</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            RM{Math.round(it.total_cost).toLocaleString()}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            of RM{Math.round(trip.budget).toLocaleString()} budget
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Budget Utilisation</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {Math.round(pct)}%
          </p>
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full ${pct > 100 ? 'bg-red-500' : 'bg-brand-600'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>

        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Scheduled Stops</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {it.places_count}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            across {trip.days} day{trip.days > 1 ? 's' : ''}
          </p>
        </div>

        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Travel Distance</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {Math.round(it.total_distance_km)} km
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Estimated road distance</p>
        </div>
      </div>

      {/* Trip Summary */}
      <div className="surface p-4 sm:p-5 border-l-2 border-l-brand-600">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Itinerary Summary
        </p>
        <p className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {it.summary_text}
        </p>
      </div>

      {/* Main 2-column grid */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left: Schedule */}
        <div className="lg:col-span-7 space-y-4">
          {/* Segmented day filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveDay('all')}
              className={`btn btn-sm ${
                activeDay === 'all'
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                  : 'btn-secondary'
              }`}
            >
              All Days
            </button>
            {dayNumbers.map((d) => {
              const key = String(d);
              const selected = activeDay === key;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setActiveDay(key)}
                  className={`btn btn-sm ${
                    selected
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950'
                      : 'btn-secondary'
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: DAY_COLORS[(d - 1) % DAY_COLORS.length] }}
                  />
                  Day {d}
                </button>
              );
            })}
          </div>

          {dayNumbers.map((d) => {
            const key = String(d);
            if (activeDay !== 'all' && activeDay !== key) return null;
            const segs = it.days[key] || [];
            const dayColor = DAY_COLORS[(d - 1) % DAY_COLORS.length];

            return (
              <section key={d} className="surface overflow-hidden">
                <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: dayColor }} />
                    <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Day {d}
                    </h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {trip.day_dates[d - 1]}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {segs.length} stop{segs.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {segs.length === 0 ? (
                  <p className="p-5 text-sm text-zinc-500 dark:text-zinc-400">
                    No scheduled stops for this day.
                  </p>
                ) : (
                  <ol className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {segs.map((s) => (
                      <li key={s.id} className="p-4 sm:p-5 flex gap-4">
                        <div className="w-16 shrink-0 tabular-nums">
                          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {s.arrive_time}
                          </p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">
                            {s.depart_time}
                          </p>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white shrink-0"
                              style={{ background: dayColor }}
                            >
                              {s.order_no}
                            </span>
                            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                              {s.asset.name}
                            </h3>
                            <Badge variant="neutral">{s.asset.category}</Badge>
                          </div>

                          {s.asset.description && (
                            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                              {s.asset.description}
                            </p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <Car className="h-3.5 w-3.5 text-zinc-400" />
                              {s.travel_km} km from previous stop
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Ticket className="h-3.5 w-3.5 text-zinc-400" />
                              {s.cost === 0 ? 'Free' : `RM${Math.round(s.cost).toLocaleString()}`}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5 text-zinc-400" />
                              {s.asset.open_time}–{s.asset.close_time}
                            </span>
                            <span
                              className="inline-flex items-center gap-1"
                              title="Fuzzy logic suitability score"
                            >
                              <Star className="h-3.5 w-3.5 text-zinc-400" />
                              Score {s.suitability.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        {/* Right: Map + Expense Breakdown + Metrics */}
        <div className="lg:col-span-5 space-y-4">
          <div className="surface overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Route Map
              </h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {activeDay === 'all' ? 'All days' : `Day ${activeDay}`}
              </span>
            </div>
            <ItineraryMap data={payload.map_data} activeDay={activeDay} />
          </div>

          <div className="surface p-5">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Expense Breakdown
            </h2>
            <div className="h-52 mt-4">
              <canvas ref={catCanvasRef} />
            </div>
            <div className="h-44 mt-5 pt-5 border-t border-zinc-100 dark:border-zinc-800">
              <canvas ref={dayCanvasRef} />
            </div>

            <details className="group mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <summary className="flex cursor-pointer items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300 list-none">
                <span>Itemised Expense Ledger</span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {it.expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2 pr-2 text-zinc-400 whitespace-nowrap">
                          {e.day_no === 0 ? 'Trip' : `Day ${e.day_no}`}
                        </td>
                        <td className="py-2 pr-2 text-zinc-700 dark:text-zinc-300">
                          {e.description}
                        </td>
                        <td className="py-2 text-right font-medium text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap">
                          RM
                          {e.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                    <tr className="font-semibold text-zinc-950 dark:text-zinc-50">
                      <td />
                      <td className="pt-2.5">Total</td>
                      <td className="pt-2.5 text-right tabular-nums">
                        RM
                        {it.total_cost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          {it.metrics && (
            <details className="group surface p-5">
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-zinc-950 dark:text-zinc-50 list-none">
                <span>Optimisation Summary</span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    NLP Extraction:{' '}
                  </span>
                  {nlpEntries.length > 0 ? (
                    <span className="inline-flex flex-wrap gap-1 mt-1">
                      {nlpEntries.map(([k, v]) => (
                        <Badge key={k} variant="neutral">
                          {k}: {Array.isArray(v) ? v.join(', ') : v}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span>Structured form parameters used.</span>
                  )}
                </div>
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    Fuzzy Logic Ranking:{' '}
                  </span>
                  Evaluated all active attractions in {trip.region} and selected the top{' '}
                  {it.metrics.candidates} candidates.
                </p>
                <p>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    ALNS Optimiser:{' '}
                  </span>
                  Completed {it.metrics.iterations} iterations in{' '}
                  {Math.round(it.metrics.runtime_ms)} ms. Objective improved from{' '}
                  {it.metrics.initial_objective} to {it.metrics.best_objective} (+
                  {it.metrics.improvement_pct}%).
                </p>
              </div>
            </details>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmRegen}
        title="Regenerate itinerary"
        description="Running the optimiser again will replace the current daily schedule and expense breakdown for this trip."
        confirmLabel="Regenerate"
        variant="primary"
        loading={regenerating}
        onConfirm={handleRegenerate}
        onCancel={() => setConfirmRegen(false)}
      />
    </div>
  );
}
