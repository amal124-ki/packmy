'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface TravelAssetItem {
  id: number;
  name: string;
  asset_type: string;
  category: string;
  region: string;
  est_cost: number;
  open_time: string;
  close_time: string;
  rating: number;
  is_active: boolean;
}

const PAGE_SIZE = 15;

function AdminAssetsContent() {
  const { user, loadingAuth, flash, clearFlashes } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedRegion = searchParams.get('region') || '';

  const [items, setItems] = useState<TravelAssetItem[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [deleteTarget, setDeleteTarget] = useState<TravelAssetItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAssets = useCallback(
    async (regionFilter: string) => {
      const qs = regionFilter ? `?region=${encodeURIComponent(regionFilter)}` : '';
      const res = await apiFetch<{ items: TravelAssetItem[]; regions: string[] }>(
        `/api/admin/assets${qs}`
      );
      if (res.status === 401) {
        router.replace('/login?next=/admin/assets');
        return;
      }
      if (res.status === 403) {
        router.replace('/dashboard');
        return;
      }
      if (res.ok) {
        setItems(res.data.items || []);
        setRegions(res.data.regions || []);
      }
      setLoading(false);
    },
    [router]
  );

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.replace('/login?next=/admin/assets');
      return;
    }
    if (!user.is_admin) {
      router.replace('/dashboard');
      return;
    }
    loadAssets(selectedRegion);
  }, [loadingAuth, user, router, selectedRegion, loadAssets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (typeFilter !== 'all' && a.asset_type !== typeFilter) return false;
      if (statusFilter === 'active' && !a.is_active) return false;
      if (statusFilter === 'hidden' && a.is_active) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q) ||
        a.region.toLowerCase().includes(q)
      );
    });
  }, [items, query, typeFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, typeFilter, statusFilter, selectedRegion]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function handleRegionChange(val: string) {
    if (val) {
      router.push(`/admin/assets?region=${encodeURIComponent(val)}`);
    } else {
      router.push('/admin/assets');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    clearFlashes();
    setDeleting(true);
    const res = await apiFetch<{ message?: string }>(
      `/api/admin/assets/${deleteTarget.id}/delete`,
      { method: 'POST' }
    );
    setDeleting(false);
    if (res.ok) {
      flash(res.data.message || `Removed '${deleteTarget.name}'.`, 'info');
      loadAssets(selectedRegion);
    } else {
      flash(res.error || 'Unable to remove asset.', 'error');
    }
    setDeleteTarget(null);
  }

  if (loadingAuth || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travel Assets"
        description={`Manage attractions and accommodations used by the itinerary optimiser (${filtered.length} matching).`}
        actions={
          <Link href="/admin/assets/new" className="btn-accent">
            <Plus className="h-4 w-4" />
            Add Asset
          </Link>
        }
      />

      {/* Filter toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, category, or region..."
            className="input pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by region"
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="input w-auto min-w-[140px]"
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by asset type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input w-auto min-w-[130px]"
          >
            <option value="all">All types</option>
            <option value="attraction">Attractions</option>
            <option value="accommodation">Hotels</option>
          </select>

          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto min-w-[130px]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="hidden">Hidden</option>
          </select>
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Type</th>
                  <th className="th">Region</th>
                  <th className="th">Category</th>
                  <th className="th text-right">Cost (RM)</th>
                  <th className="th">Hours</th>
                  <th className="th text-right">Rating</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {paginated.map((a) => (
                  <tr
                    key={a.id}
                    className={`hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors ${
                      !a.is_active ? 'opacity-65' : ''
                    }`}
                  >
                    <td className="td font-medium text-zinc-950 dark:text-zinc-50">{a.name}</td>
                    <td className="td">
                      {a.asset_type === 'accommodation' ? (
                        <Badge variant="info">Hotel</Badge>
                      ) : (
                        <Badge variant="brand">Attraction</Badge>
                      )}
                    </td>
                    <td className="td">{a.region}</td>
                    <td className="td capitalize">{a.category}</td>
                    <td className="td text-right tabular-nums whitespace-nowrap">
                      {Math.round(a.est_cost)}
                      {a.asset_type === 'accommodation' ? '/night' : ''}
                    </td>
                    <td className="td whitespace-nowrap tabular-nums">
                      {a.open_time}–{a.close_time}
                    </td>
                    <td className="td text-right tabular-nums">{a.rating.toFixed(1)}</td>
                    <td className="td">
                      {a.is_active ? (
                        <Badge variant="success" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="neutral" dot>
                          Hidden
                        </Badge>
                      )}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/admin/assets/${a.id}/edit`}
                          className="btn-ghost btn-sm !px-2"
                          title={`Edit ${a.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(a)}
                          className="btn-ghost btn-sm !px-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title={`Delete ${a.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      ) : (
        <EmptyState
          icon={MapPin}
          title="No travel assets found"
          description="Adjust your search or filter criteria, or add a new destination asset."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setTypeFilter('all');
                setStatusFilter('all');
                if (selectedRegion) router.push('/admin/assets');
              }}
              className="btn-secondary btn-sm"
            >
              Reset filters
            </button>
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete travel asset"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? If this asset is referenced in existing itineraries, it will be marked as hidden instead of deleted.`
            : ''
        }
        confirmLabel="Delete asset"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function AdminAssetsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminAssetsContent />
    </Suspense>
  );
}
