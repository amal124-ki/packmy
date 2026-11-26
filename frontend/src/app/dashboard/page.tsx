'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Compass,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface TripSummary {
  id: number;
  region: string;
  days: number;
  start_date: string;
  budget: number;
  travellers: number;
  interests: string[];
  status: string;
  has_itinerary: boolean;
  total_cost: number | null;
  places_count: number;
}

export default function DashboardPage() {
  const { user, loadingAuth, flash, clearFlashes } = useApp();
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TripSummary | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const loadTrips = useCallback(async () => {
    const res = await apiFetch<{ trips: TripSummary[] }>('/api/trips');
    if (res.status === 401) {
      router.replace('/login?next=/dashboard');
      return;
    }
    if (res.ok) {
      setTrips(res.data.trips || []);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!loadingAuth) {
      if (!user) {
        router.replace('/login?next=/dashboard');
      } else {
        loadTrips();
      }
    }
  }, [loadingAuth, user, router, loadTrips]);

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.region.toLowerCase().includes(q) ||
        t.interests.some((i) => i.toLowerCase().includes(q))
      );
    });
  }, [trips, query, statusFilter]);

  async function handleRegenerate(tripId: number) {
    clearFlashes();
    setBusyId(tripId);
    const res = await apiFetch<{ trip_id: number; message?: string }>(
      `/api/trips/${tripId}/regenerate`,
      { method: 'POST' }
    );
    setBusyId(null);
    if (!res.ok) {
      flash(res.error || 'Unable to generate itinerary. Please try again.', 'error');
      loadTrips();
      return;
    }
    flash(res.data.message || 'Itinerary regenerated.', 'success');
    router.push(`/trip/${tripId}`);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    clearFlashes();
    setBusyId(deleteTarget.id);
    const res = await apiFetch<{ message?: string }>(`/api/trips/${deleteTarget.id}/delete`, {
      method: 'POST',
    });
    setBusyId(null);
    if (res.ok) {
      flash(res.data.message || 'Trip deleted.', 'info');
      setTrips((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    } else {
      flash(res.error || 'Unable to delete trip.', 'error');
    }
    setDeleteTarget(null);
  }

  if (loadingAuth || loading || !user) {
    return <PageSkeleton />;
  }

  const hasProfileInterests = user.profile && user.profile.interests.length > 0;
  const readyCount = trips.filter((t) => t.status === 'done').length;
  const totalDays = trips.reduce((sum, t) => sum + t.days, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Trips"
        description={`Signed in as ${user.name}. Review saved itineraries or plan a new trip.`}
        actions={
          <Link href="/trip/new" className="btn-accent">
            <Plus className="h-4 w-4" />
            New Trip
          </Link>
        }
      />

      {!hasProfileInterests && (
        <AlertBanner
          variant="info"
          message="Complete your travel profile to automatically pre-fill default budget, pace, and interests."
          action={
            <Link href="/profile" className="btn-secondary btn-sm">
              Set up profile
            </Link>
          }
        />
      )}

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Total Trips</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {trips.length}
          </p>
        </div>
        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Ready Itineraries</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {readyCount}
          </p>
        </div>
        <div className="surface p-4">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Planned Days</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            {totalDays}
          </p>
        </div>
      </div>

      {trips.length > 0 ? (
        <>
          {/* Filter controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by destination or interest..."
                className="input pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter trips by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input w-auto min-w-[140px]"
              >
                <option value="all">All statuses</option>
                <option value="done">Ready</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {filteredTrips.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTrips.map((t) => (
                <div
                  key={t.id}
                  className="surface p-5 flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-brand-600 dark:text-brand-400">
                          {t.region}
                        </p>
                        <h3 className="mt-0.5 text-base font-semibold text-zinc-950 dark:text-zinc-50">
                          {t.days}-Day Itinerary
                        </h3>
                      </div>
                      {t.status === 'done' ? (
                        <Badge variant="success" dot>
                          Ready
                        </Badge>
                      ) : t.status === 'failed' ? (
                        <Badge variant="danger" dot>
                          Failed
                        </Badge>
                      ) : (
                        <Badge variant="neutral" dot>
                          Pending
                        </Badge>
                      )}
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        <span>Starts {t.start_date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-zinc-400" />
                        <span>
                          {t.travellers} traveller{t.travellers > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wallet className="h-3.5 w-3.5 text-zinc-400" />
                        <span>
                          Budget RM{Math.round(t.budget).toLocaleString()}
                          {t.has_itinerary && t.total_cost !== null && (
                            <>
                              {' '}
                              · Est.{' '}
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                RM{Math.round(t.total_cost).toLocaleString()}
                              </span>{' '}
                              ({t.places_count} stops)
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    {t.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-4">
                        {t.interests.map((i) => (
                          <Badge key={i} variant="neutral">
                            {i}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                    {t.has_itinerary ? (
                      <Link href={`/trip/${t.id}`} className="btn-primary btn-sm flex-1">
                        Open Itinerary
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busyId === t.id}
                        onClick={() => handleRegenerate(t.id)}
                        className="btn-primary btn-sm flex-1"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${busyId === t.id ? 'animate-spin' : ''}`} />
                        {busyId === t.id ? 'Generating...' : 'Retry Generation'}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => setDeleteTarget(t)}
                      aria-label={`Delete ${t.region} trip`}
                      className="btn-danger btn-sm !px-2.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No matching trips"
              description="Try adjusting your search query or status filter."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setStatusFilter('all');
                  }}
                  className="btn-secondary btn-sm"
                >
                  Clear filters
                </button>
              }
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={Compass}
          title="No trips planned yet"
          description="Create your first trip request to generate an optimised day-by-day Malaysian itinerary."
          action={
            <Link href="/trip/new" className="btn-accent">
              <Plus className="h-4 w-4" />
              Plan your first trip
            </Link>
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete trip"
        description={
          deleteTarget
            ? `Are you sure you want to permanently delete your ${deleteTarget.days}-day ${deleteTarget.region} trip and its saved itinerary?`
            : ''
        }
        confirmLabel="Delete trip"
        variant="danger"
        loading={Boolean(deleteTarget && busyId === deleteTarget.id)}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
