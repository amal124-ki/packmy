'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface AssetPayload {
  id?: number;
  name: string;
  asset_type: string;
  category: string;
  tags: string;
  region: string;
  latitude: number | string;
  longitude: number | string;
  est_cost: number | string;
  visit_minutes: number | string;
  open_time: string;
  close_time: string;
  rating: number | string;
  description: string;
  is_active: boolean;
}

export function AssetForm({ assetId }: { assetId?: string }) {
  const { user, loadingAuth, flash, clearFlashes } = useApp();
  const router = useRouter();
  const isEdit = Boolean(assetId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState('attraction');
  const [category, setCategory] = useState('culture');
  const [region, setRegion] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [tags, setTags] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [estCost, setEstCost] = useState('0');
  const [visitMinutes, setVisitMinutes] = useState('60');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('18:00');
  const [rating, setRating] = useState('4');
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState('');

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

    const endpoint = isEdit ? `/api/admin/assets/${assetId}` : '/api/admin/assets';
    apiFetch<{ asset?: AssetPayload; regions: string[]; categories: string[] }>(endpoint).then(
      (res) => {
        if (res.status === 401) {
          router.replace('/login?next=/admin/assets');
          return;
        }
        if (res.status === 404) {
          flash('Travel asset not found.', 'error');
          router.replace('/admin/assets');
          return;
        }
        if (res.ok) {
          const regs = res.data.regions || [];
          const cats = res.data.categories || [];
          setRegions(regs);
          setCategories(cats);
          if (res.data.asset) {
            const a = res.data.asset;
            setName(a.name || '');
            setAssetType(a.asset_type || 'attraction');
            setCategory(a.category || cats[0] || 'culture');
            setRegion(a.region || regs[0] || '');
            setTags(a.tags || '');
            setLatitude(String(a.latitude ?? ''));
            setLongitude(String(a.longitude ?? ''));
            setEstCost(String(a.est_cost ?? 0));
            setVisitMinutes(String(a.visit_minutes ?? 60));
            setOpenTime(a.open_time || '09:00');
            setCloseTime(a.close_time || '18:00');
            setRating(String(a.rating ?? 4));
            setIsActive(Boolean(a.is_active));
            setDescription(a.description || '');
          } else {
            setRegion(regs[0] || '');
            setCategory(cats[0] || 'culture');
          }
        }
        setLoading(false);
      }
    );
  }, [loadingAuth, user, router, isEdit, assetId, flash]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearFlashes();
    setError('');
    setSaving(true);
    const res = await apiFetch<{ asset?: AssetPayload; message?: string }>(
      isEdit ? `/api/admin/assets/${assetId}` : '/api/admin/assets',
      {
        method: isEdit ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          asset_type: assetType,
          category,
          region,
          new_region: newRegion,
          tags,
          latitude,
          longitude,
          est_cost: estCost,
          visit_minutes: visitMinutes,
          open_time: openTime,
          close_time: closeTime,
          rating,
          is_active: isActive,
          description,
        }),
      }
    );
    setSaving(false);

    if (!res.ok) {
      setError(res.error || 'Unable to save asset. Please check all required fields.');
      return;
    }

    const savedRegion = res.data.asset?.region || newRegion || region;
    flash(res.data.message || `Saved '${name}'.`, 'success');
    router.push(`/admin/assets?region=${encodeURIComponent(savedRegion)}`);
  }

  if (loadingAuth || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={isEdit ? 'Edit Travel Asset' : 'New Travel Asset'}
        description="Configure location metadata, pricing, and operating hours for itinerary planning."
        backHref="/admin/assets"
        backLabel="Back to Travel Assets"
      />

      {error && <AlertBanner variant="error" message={error} onDismiss={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Basic Info */}
        <section className="surface p-6">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Basic Information
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="asset-name">
                Asset name
              </label>
              <input
                id="asset-name"
                className="input"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-type">
                Asset type
              </label>
              <select
                id="asset-type"
                className="input"
                name="asset_type"
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
              >
                <option value="attraction">Attraction</option>
                <option value="accommodation">Accommodation (Hotel)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="asset-category">
                Primary category
              </label>
              <select
                id="asset-category"
                className="input"
                name="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="asset-region">
                Region
              </label>
              <select
                id="asset-region"
                className="input"
                name="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="asset-new-region">
                Or create new region
              </label>
              <input
                id="asset-new-region"
                className="input"
                name="new_region"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="e.g. Ipoh"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="asset-tags">
                Interest tags (comma separated)
              </label>
              <input
                id="asset-tags"
                className="input"
                name="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. heritage, museum, view"
              />
            </div>
          </div>
        </section>

        {/* Section 2: Coordinates */}
        <section className="surface p-6">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Location Coordinates
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Decimal latitude and longitude used for distance calculations and route mapping.
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label" htmlFor="asset-lat">
                Latitude
              </label>
              <input
                id="asset-lat"
                className="input"
                name="latitude"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-lng">
                Longitude
              </label>
              <input
                id="asset-lng"
                className="input"
                name="longitude"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>
        </section>

        {/* Section 3: Pricing & Schedule */}
        <section className="surface p-6">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Pricing and Operating Hours
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="label" htmlFor="asset-cost">
                Estimated cost (RM per person / per room-night)
              </label>
              <input
                id="asset-cost"
                className="input"
                name="est_cost"
                type="number"
                step="0.5"
                min={0}
                value={estCost}
                onChange={(e) => setEstCost(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-mins">
                Visit duration (minutes)
              </label>
              <input
                id="asset-mins"
                className="input"
                name="visit_minutes"
                type="number"
                min={0}
                value={visitMinutes}
                onChange={(e) => setVisitMinutes(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-open">
                Opening time
              </label>
              <input
                id="asset-open"
                className="input"
                name="open_time"
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-close">
                Closing time
              </label>
              <input
                id="asset-close"
                className="input"
                name="close_time"
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="asset-rating">
                Rating (1.0 – 5.0)
              </label>
              <input
                id="asset-rating"
                className="input"
                name="rating"
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 select-none">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 accent-brand-600"
                />
                Active in itinerary planner
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="asset-desc">
                Description
              </label>
              <textarea
                id="asset-desc"
                className="input"
                name="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link href="/admin/assets" className="btn-secondary">
            Cancel
          </Link>
          <button disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Asset'}
          </button>
        </div>
      </form>
    </div>
  );
}
