'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RotateCcw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

const FIELDS = [
  [
    'iterations',
    'Iterations',
    '1',
    'Number of destroy-and-repair rounds per itinerary run (10 to 3000). Higher values improve quality at higher runtime.',
  ],
  [
    'destroy_min',
    'Destroy minimum fraction',
    '0.01',
    'Minimum share of scheduled stops removed per iteration (e.g. 0.15 = 15%).',
  ],
  [
    'destroy_max',
    'Destroy maximum fraction',
    '0.01',
    'Maximum share of scheduled stops removed per iteration.',
  ],
  [
    'start_temperature_pct',
    'Initial temperature factor',
    '0.01',
    'Simulated annealing acceptance threshold at iteration 0 (0.05 accepts a 5% worse candidate with 50% probability).',
  ],
  [
    'cooling_rate',
    'Cooling rate',
    '0.001',
    'Per-iteration temperature multiplier (0.990 to 0.999). Lower values tighten acceptance faster.',
  ],
  [
    'reaction_factor',
    'Adaptive reaction factor',
    '0.01',
    'Weight update rate for destroy and repair operators (0 to 1).',
  ],
  [
    'distance_weight',
    'Distance penalty weight',
    '0.1',
    'Penalty applied per kilometre of road travel relative to fuzzy suitability scores.',
  ],
] as const;

type ParamKey = (typeof FIELDS)[number][0];

export default function AdminSettingsPage() {
  const { user, loadingAuth, flash, clearFlashes } = useApp();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const [values, setValues] = useState<Record<ParamKey, string>>({
    iterations: '400',
    destroy_min: '0.15',
    destroy_max: '0.4',
    start_temperature_pct: '0.05',
    cooling_rate: '0.995',
    reaction_factor: '0.2',
    distance_weight: '1',
  });

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.replace('/login?next=/admin/settings');
      return;
    }
    if (!user.is_admin) {
      router.replace('/dashboard');
      return;
    }
    apiFetch<{ params: Record<string, number> }>('/api/admin/settings').then((res) => {
      if (res.status === 401) {
        router.replace('/login?next=/admin/settings');
        return;
      }
      if (res.status === 403) {
        router.replace('/dashboard');
        return;
      }
      if (res.ok && res.data.params) {
        const p = res.data.params;
        setValues({
          iterations: String(p.iterations ?? 400),
          destroy_min: String(p.destroy_min ?? 0.15),
          destroy_max: String(p.destroy_max ?? 0.4),
          start_temperature_pct: String(p.start_temperature_pct ?? 0.05),
          cooling_rate: String(p.cooling_rate ?? 0.995),
          reaction_factor: String(p.reaction_factor ?? 0.2),
          distance_weight: String(p.distance_weight ?? 1.0),
        });
      }
      setLoading(false);
    });
  }, [loadingAuth, user, router]);

  async function save(reset = false) {
    clearFlashes();
    setError('');
    setSaving(true);
    const res = await apiFetch<{ params: Record<string, number>; message?: string }>(
      '/api/admin/settings',
      {
        method: 'POST',
        body: JSON.stringify(reset ? { reset: true } : values),
      }
    );
    setSaving(false);
    setConfirmReset(false);

    if (!res.ok) {
      setError(res.error || 'Invalid parameter value.');
      return;
    }

    if (res.data.params) {
      const p = res.data.params;
      setValues({
        iterations: String(p.iterations ?? 400),
        destroy_min: String(p.destroy_min ?? 0.15),
        destroy_max: String(p.destroy_max ?? 0.4),
        start_temperature_pct: String(p.start_temperature_pct ?? 0.05),
        cooling_rate: String(p.cooling_rate ?? 0.995),
        reaction_factor: String(p.reaction_factor ?? 0.2),
        distance_weight: String(p.distance_weight ?? 1.0),
      });
    }
    flash(
      res.data.message || 'ALNS parameters saved. New itinerary requests will use these values.',
      'success'
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save(false);
  }

  if (loadingAuth || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="ALNS Parameters"
        description="Configure Adaptive Large Neighbourhood Search hyperparameters for new itinerary requests."
        actions={
          <button
            type="button"
            disabled={saving}
            onClick={() => setConfirmReset(true)}
            className="btn-secondary"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Defaults
          </button>
        }
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />}

      <form onSubmit={handleSubmit} className="surface overflow-hidden">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {FIELDS.map(([key, label, step, help]) => (
            <div
              key={key}
              className="p-5 grid sm:grid-cols-12 gap-3 sm:gap-6 items-start"
            >
              <div className="sm:col-span-7">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100" htmlFor={key}>
                  {label}
                </label>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {help}
                </p>
              </div>
              <div className="sm:col-span-5">
                <input
                  className="input tabular-nums"
                  type="number"
                  step={step}
                  id={key}
                  name={key}
                  value={values[key]}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  required
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 px-5 py-3.5">
          <button disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Parameters'}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmReset}
        title="Reset ALNS parameters"
        description="Restore all ALNS solver parameters to their default values? This will take effect for future itinerary generations."
        confirmLabel="Reset to defaults"
        variant="primary"
        loading={saving}
        onConfirm={() => save(true)}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
