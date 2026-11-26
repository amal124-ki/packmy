'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, MessageSquareText, Route, Wallet } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';

const CAPABILITIES = [
  {
    icon: MessageSquareText,
    title: 'Structured Preference Parsing',
    description:
      'Enter natural trip requirements or structured parameters to specify destination, duration, budget, and travel pace.',
  },
  {
    icon: Wallet,
    title: 'Budget-Aware Selection',
    description:
      'Accounts for accommodation, daily meals, entrance fees, and estimated transport distance before scheduling stops.',
  },
  {
    icon: Route,
    title: 'Constraint-Checked Routing',
    description:
      'Orders daily visits around opening hours, visit durations, lunch breaks, and geographic proximity to reduce travel time.',
  },
];

const IMG_MAP: Record<string, string> = {
  'Kuala Lumpur': 'kl',
  'Kota Kinabalu': 'kk',
};

export default function HomePage() {
  const { user } = useApp();
  const [regions, setRegions] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ regions: string[]; counts: Record<string, number> }>('/api/home').then((res) => {
      if (res.ok) {
        setRegions(res.data.regions || []);
        setCounts(res.data.counts || {});
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {/* Hero section */}
      <section className="bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <Badge variant="brand" dot>
              Malaysian Itinerary Engine
            </Badge>
            <h1 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 leading-[1.15]">
              Structured daily itineraries built around your budget and schedule.
            </h1>
            <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              Describe your trip in plain language or configure trip parameters directly. PackMY
              ranks attractions, validates opening hours, and generates a day-by-day route with cost
              breakdowns and PDF export.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={user ? (user.is_admin ? '/admin' : '/trip/new') : '/register'}
                className="btn-primary px-5 py-2.5"
              >
                {user ? (user.is_admin ? 'Open Admin Console' : 'Plan a Trip') : 'Get Started'}
                <ArrowRight className="h-4 w-4" />
              </Link>
              {!user && (
                <Link href="/login" className="btn-secondary px-5 py-2.5">
                  Sign in
                </Link>
              )}
            </div>
          </div>

          {/* Product preview card */}
          <div className="lg:col-span-6">
            <div className="surface overflow-hidden shadow-card">
              <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Sample Input and Generated Schedule
                </span>
                <Badge variant="success" dot>
                  Optimised
                </Badge>
              </div>
              <div className="p-5 space-y-4">
                <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                    Trip Request
                  </p>
                  <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                    &quot;3 days in Penang for 2 travellers, RM1,500 budget. Street food and
                    heritage at a relaxed pace.&quot;
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="brand">Region: Penang</Badge>
                  <Badge variant="neutral">3 days</Badge>
                  <Badge variant="neutral">RM1,500</Badge>
                  <Badge variant="neutral">2 travellers</Badge>
                  <Badge variant="neutral">Food, Heritage</Badge>
                  <Badge variant="neutral">Relaxed pace</Badge>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3.5 space-y-2.5">
                  {[
                    ['Day 1', 'George Town Street Art, Chew Jetty, Chulia Street Hawkers'],
                    ['Day 2', 'Kek Lok Si Temple, Batu Ferringhi Beach, Gurney Drive'],
                    ['Day 3', 'Pinang Peranakan Mansion, Cheong Fatt Tze Mansion'],
                  ].map(([day, stops]) => (
                    <div key={day} className="grid grid-cols-12 gap-2 text-xs">
                      <span className="col-span-2 font-semibold text-zinc-900 dark:text-zinc-100">
                        {day}
                      </span>
                      <span className="col-span-10 text-zinc-600 dark:text-zinc-400">{stops}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="bg-zinc-50 dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              How PackMY plans each trip
            </h2>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Three coordinated stages convert trip requirements into a feasible daily timetable.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div key={cap.title} className="surface p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/70 text-brand-600 dark:text-brand-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                    {cap.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Supported Destinations */}
      <section className="bg-white dark:bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
                Supported Destinations
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Select a region to pre-fill the trip planner.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-40 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
              {regions.map((r) => {
                const slug = IMG_MAP[r] || r.toLowerCase().replace(/ /g, '-');
                return (
                  <Link
                    key={r}
                    href={`/trip/new?region=${encodeURIComponent(r)}`}
                    className="group relative overflow-hidden rounded-lg h-40 border border-zinc-200 dark:border-zinc-800 bg-zinc-900 transition hover:border-zinc-400 dark:hover:border-zinc-600"
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
                      style={{ backgroundImage: `url('/img/region/${slug}.jpg')` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent" />
                    <div className="relative h-full p-4 flex flex-col justify-end text-white">
                      <span className="font-semibold text-sm leading-tight">{r}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-200">
                        <MapPin className="h-3 w-3" />
                        {counts[r] ?? 0} attractions
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
