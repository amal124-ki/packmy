'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users as UsersIcon } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';

interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  role: string;
  is_admin: boolean;
  is_active_account: boolean;
  created_at: string;
  trip_count: number;
}

const PAGE_SIZE = 15;

export default function AdminUsersPage() {
  const { user, loadingAuth, flash, clearFlashes } = useApp();
  const router = useRouter();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [toggleTarget, setToggleTarget] = useState<AdminUserRow | null>(null);
  const [toggling, setToggling] = useState(false);

  const loadUsers = useCallback(async () => {
    const res = await apiFetch<{ rows: AdminUserRow[]; current_user_id: number }>(
      '/api/admin/users'
    );
    if (res.status === 401) {
      router.replace('/login?next=/admin/users');
      return;
    }
    if (res.status === 403) {
      router.replace('/dashboard');
      return;
    }
    if (res.ok) {
      setRows(res.data.rows || []);
      setCurrentUserId(res.data.current_user_id);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user) {
      router.replace('/login?next=/admin/users');
      return;
    }
    if (!user.is_admin) {
      router.replace('/dashboard');
      return;
    }
    loadUsers();
  }, [loadingAuth, user, router, loadUsers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.is_active_account) return false;
      if (statusFilter === 'deactivated' && u.is_active_account) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [rows, query, roleFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, roleFilter, statusFilter]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  async function confirmToggle() {
    if (!toggleTarget) return;
    clearFlashes();
    setToggling(true);
    const res = await apiFetch<{ is_active_account: boolean; message?: string }>(
      `/api/admin/users/${toggleTarget.id}/toggle`,
      { method: 'POST' }
    );
    setToggling(false);
    if (!res.ok) {
      flash(res.error || 'Unable to update user status.', 'error');
      setToggleTarget(null);
      return;
    }
    flash(res.data.message || 'User status updated.', 'info');
    setRows((prev) =>
      prev.map((row) =>
        row.id === toggleTarget.id
          ? { ...row, is_active_account: res.data.is_active_account }
          : row
      )
    );
    setToggleTarget(null);
  }

  if (loadingAuth || loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`Review registered accounts and manage account access (${filtered.length} total).`}
      />

      {/* Filter toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="input pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input w-auto min-w-[130px]"
          >
            <option value="all">All roles</option>
            <option value="traveller">Traveller</option>
            <option value="admin">Admin</option>
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto min-w-[130px]"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
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
                  <th className="th">Email</th>
                  <th className="th">Role</th>
                  <th className="th text-right">Trips</th>
                  <th className="th">Joined</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {paginated.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="td font-medium text-zinc-950 dark:text-zinc-50">{u.name}</td>
                    <td className="td">{u.email}</td>
                    <td className="td">
                      <Badge variant={u.is_admin ? 'warning' : 'neutral'} className="capitalize">
                        {u.role}
                      </Badge>
                    </td>
                    <td className="td text-right tabular-nums">{u.trip_count}</td>
                    <td className="td whitespace-nowrap tabular-nums">{u.created_at}</td>
                    <td className="td">
                      {u.is_active_account ? (
                        <Badge variant="success" dot>
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="danger" dot>
                          Deactivated
                        </Badge>
                      )}
                    </td>
                    <td className="td text-right whitespace-nowrap">
                      {u.id !== currentUserId ? (
                        <button
                          type="button"
                          onClick={() => setToggleTarget(u)}
                          className={
                            u.is_active_account
                              ? 'btn-danger btn-sm'
                              : 'btn-secondary btn-sm'
                          }
                        >
                          {u.is_active_account ? 'Deactivate' : 'Activate'}
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-400">Current session</span>
                      )}
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
          icon={UsersIcon}
          title="No matching users"
          description="Try clearing your search query or filters."
          action={
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setRoleFilter('all');
                setStatusFilter('all');
              }}
              className="btn-secondary btn-sm"
            >
              Reset filters
            </button>
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={
          toggleTarget?.is_active_account ? 'Deactivate user account' : 'Activate user account'
        }
        description={
          toggleTarget
            ? toggleTarget.is_active_account
              ? `Deactivating ${toggleTarget.name} (${toggleTarget.email}) will prevent them from signing in until reactivated.`
              : `Reactivate ${toggleTarget.name} (${toggleTarget.email}) so they can sign in and access their trips.`
            : ''
        }
        confirmLabel={toggleTarget?.is_active_account ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.is_active_account ? 'danger' : 'primary'}
        loading={toggling}
        onConfirm={confirmToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </div>
  );
}
