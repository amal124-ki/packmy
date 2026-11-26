'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Chart from 'chart.js/auto';
import {
  Activity,
  ArrowUpRight,
  Compass,
  Gauge,
  MapPin,
  Plus,
  Route,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface AdminDashboardData {
  stats: {
    users: number;
    assets: number;
    trips: number;
    itineraries: number;
    avg_runtime: number;
    avg_improve: number;
    avg_cost: number;
  };
  by_region: Record<string, number>;
  interest_count: Record<string, number>;
  latest_hist: number[];
  latest_weights: Record<string, number>;
  recent_trips: {
    id: number;
    user_name: string;
    region: string;
    days: number;
    budget: number;
    status: string;
    has_itinerary: boolean;
  }[];
  recent_metrics: {
    id: number;
    iterations: number;
    candidates: number;
    runtime_ms: number;
    initial_objective: number;
    best_objective: number;
    improvement_pct: number;
  }[];
}

export default function AdminDashboardPage() {
  const { user, loadingAuth, flash, theme } = useApp();
  const router = useRouter();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const regionRef = useRef<HTMLCanvasElement | null>(null);
  const interestRef = useRef<HTMLCanvasElement | null>(null);
  const convRef = useRef<HTMLCanvasElement | null>(null);
  const opRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.replace('/login?next=/admin');
      return;
    }
    if (!user.is_admin) {
      flash('Administrator access is required for this section.', 'error');
      router.replace('/dashboard');
      return;
    }

    apiFetch<AdminDashboardData>('/api/admin/dashboard').then((res) => {
      if (res.status === 401) {
        router.replace('/login?next=/admin');
        return;
      }
      if (res.status === 403) {
        router.replace('/dashboard');
        return;
      }
      if (res.ok) {
        setData(res.data);
      }
      setLoading(false);
    });
  }, [loadingAuth, user, router, flash]);

  useEffect(() => {
    if (!data || !regionRef.current || !interestRef.current || !convRef.current || !opRef.current) {
      return;
    }

    const isDark = theme === 'dark';
    const textColor = isDark ? '#a1a1aa' : '#52525b';
    const gridColor = isDark ? '#27272a' : '#f4f4f5';

    const baseOpts = {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    };

    const c1 = new Chart(regionRef.current, {
      type: 'bar',
      options: {
        ...baseOpts,
        scales: {
          x: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
          y: {
            beginAtZero: true,
            ticks: { precision: 0, color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
          },
        },
      },
      data: {
        labels: Object.keys(data.by_region),
        datasets: [
          {
            data: Object.values(data.by_region),
            backgroundColor: '#0d9488',
            borderRadius: 4,
            maxBarThickness: 36,
          },
        ],
      },
    });

    const c2 = new Chart(interestRef.current, {
      type: 'bar',
      options: {
        ...baseOpts,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
          },
          y: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
        },
      },
      data: {
        labels: Object.keys(data.interest_count),
        datasets: [
          {
            data: Object.values(data.interest_count),
            backgroundColor: '#d97706',
            borderRadius: 4,
            maxBarThickness: 20,
          },
        ],
      },
    });

    const c3 = new Chart(convRef.current, {
      type: 'line',
      options: {
        ...baseOpts,
        scales: {
          x: {
            title: { display: true, text: 'Iteration', color: textColor, font: { size: 11 } },
            ticks: { color: textColor, font: { size: 11 } },
            grid: { display: false },
          },
          y: {
            ticks: { color: textColor, font: { size: 11 } },
            grid: { color: gridColor },
          },
        },
      },
      data: {
        labels: data.latest_hist.map((_, i) => i * 10),
        datasets: [
          {
            data: data.latest_hist,
            borderColor: '#0d9488',
            backgroundColor: isDark ? 'rgba(20, 184, 166, 0.14)' : 'rgba(13, 148, 136, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.2,
            pointRadius: 0,
          },
        ],
      },
    });

    const w = data.latest_weights;
    const c4 = new Chart(opRef.current, {
      type: 'bar',
      options: {
        ...baseOpts,
        indexAxis: 'y',
        scales: {
          x: { ticks: { color: textColor, font: { size: 11 } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } },
        },
      },
      data: {
        labels: Object.keys(w).map((k) => k.replace(/_/g, ' ')),
        datasets: [
          {
            data: Object.values(w),
            backgroundColor: Object.keys(w).map((k) =>
              k.includes('removal') ? '#e11d48' : '#2563eb'
            ),
            borderRadius: 4,
            maxBarThickness: 20,
          },
        ],
      },
    });

    return () => {
      c1.destroy();
      c2.destroy();
      c3.destroy();
      c4.destroy();
    };
  }, [data, theme]);

  if (loadingAuth || loading || !data) {
    return <PageSkeleton />;
  }

  const { stats, recent_trips, recent_metrics } = data;

  const primaryKpis = [
    { label: 'Travellers', value: stats.users, icon: Users },
    { label: 'Travel Assets', value: stats.assets, icon: MapPin },
    { label: 'Trip Requests', value: stats.trips, icon: Compass },
    { label: 'Generated Itineraries', value: stats.itineraries, icon: Route },
  ];

  const performanceKpis = [
    {
      label: 'Average ALNS Runtime',
      value: `${Math.round(stats.avg_runtime)} ms`,
      icon: Gauge,
    },
    {
      label: 'Average Objective Gain',
      value: `+${stats.avg_improve.toFixed(1)}%`,
      icon: TrendingUp,
    },
    {
      label: 'Average Trip Cost',
      value: `RM${Math.round(stats.avg_cost).toLocaleString()}`,
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Overview"
        description="System usage statistics and ALNS optimiser performance metrics."
        actions={
          <Link href="/admin/assets/new" className="btn-accent">
            <Plus className="h-4 w-4" />
            Add Travel Asset
          </Link>
        }
      />

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryKpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Performance KPIs */}
      <div className="grid sm:grid-cols-3 gap-4">
        {performanceKpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="surface p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
                {value}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400">
              <Icon className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface p-5">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Trips by Region</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Total trip requests grouped by Malaysian destination.
          </p>
          <div className="h-60 mt-4">
            <canvas ref={regionRef} />
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Requested Interests
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Frequency of interest categories selected across trip requests.
          </p>
          <div className="h-60 mt-4">
            <canvas ref={interestRef} />
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Latest ALNS Convergence
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Best objective value sampled every 10 iterations.
              </p>
            </div>
            <Activity className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="h-60 mt-4">
            <canvas ref={convRef} />
          </div>
        </div>

        <div className="surface p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                Latest ALNS Operator Weights
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Destroy operators (red) and repair operators (blue) at completion.
              </p>
            </div>
          </div>
          <div className="h-60 mt-4">
            <canvas ref={opRef} />
          </div>
        </div>
      </div>

      {/* Recent Tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="surface overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Recent Trip Requests
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Traveller</th>
                  <th className="th">Region</th>
                  <th className="th">Days</th>
                  <th className="th text-right">Budget</th>
                  <th className="th text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {recent_trips.length > 0 ? (
                  recent_trips.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="td font-medium text-zinc-900 dark:text-zinc-100">
                        {t.user_name}
                      </td>
                      <td className="td">{t.region}</td>
                      <td className="td tabular-nums">{t.days}</td>
                      <td className="td text-right tabular-nums">
                        RM{Math.round(t.budget).toLocaleString()}
                      </td>
                      <td className="td text-right">
                        {t.has_itinerary ? (
                          <Link
                            href={`/trip/${t.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline"
                          >
                            <Badge variant="success" dot>
                              {t.status}
                            </Badge>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        ) : (
                          <Badge variant={t.status === 'failed' ? 'danger' : 'neutral'} dot>
                            {t.status}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="td text-center text-zinc-400 py-8" colSpan={5}>
                      No trip requests recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="surface overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Algorithm Runs (Last 10)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Run</th>
                  <th className="th">Iter.</th>
                  <th className="th">Cand.</th>
                  <th className="th text-right">Runtime</th>
                  <th className="th text-right">Objective</th>
                  <th className="th text-right">Gain</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {recent_metrics.length > 0 ? (
                  recent_metrics.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="td font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                        #{m.id}
                      </td>
                      <td className="td tabular-nums">{m.iterations}</td>
                      <td className="td tabular-nums">{m.candidates}</td>
                      <td className="td text-right tabular-nums">
                        {Math.round(m.runtime_ms)} ms
                      </td>
                      <td className="td text-right tabular-nums whitespace-nowrap">
                        {m.initial_objective} / {m.best_objective}
                      </td>
                      <td className="td text-right">
                        <Badge variant="success">+{m.improvement_pct}%</Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="td text-center text-zinc-400 py-8" colSpan={6}>
                      No optimiser runs recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
