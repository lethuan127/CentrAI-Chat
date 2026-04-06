'use client';

import { useState, useCallback } from 'react';
import {
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Shield,
  Code2,
  User,
  Check,
  X,
} from 'lucide-react';
import { useAdminUsers } from '@/hooks/use-admin';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const ROLE_CONFIG = {
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-red-500 bg-red-500/10' },
  DEVELOPER: { label: 'Developer', icon: Code2, color: 'text-blue-500 bg-blue-500/10' },
  USER: { label: 'User', icon: User, color: 'text-muted-foreground bg-muted' },
} as const;

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.USER;
  const Icon = config.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground',
      )}
    >
      {isActive ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const { users, meta, isLoading, error, updateUser } = useAdminUsers({
    page,
    limit: 20,
    search: search || undefined,
    role: roleFilter || undefined,
    sort: 'createdAt',
    order: 'desc',
  });

  const handleRoleChange = useCallback(async (userId: string, role: string) => {
    try {
      await updateUser(userId, { role });
      setActiveDropdown(null);
    } catch {
      // Error handled by hook
    }
  }, [updateUser]);

  const handleToggleActive = useCallback(async (userId: string, isActive: boolean) => {
    try {
      await updateUser(userId, { isActive: !isActive });
      setActiveDropdown(null);
    } catch {
      // Error handled by hook
    }
  }, [updateUser]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Users</h1>
        {meta && (
          <span className="text-sm text-muted-foreground">({meta.total} total)</span>
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">All Roles</option>
          <option value="ADMIN">Admin</option>
          <option value="DEVELOPER">Developer</option>
          <option value="USER">User</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Auth</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Conversations</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last Login</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={8} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-muted/60" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-destructive">
                    {error}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {u.name?.[0]?.toUpperCase() || u.email[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{u.name || '—'}</p>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3"><StatusBadge isActive={u.isActive} /></td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">{u.authProvider}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{u.conversationCount}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== currentUser?.id && (
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActiveDropdown(activeDropdown === u.id ? null : u.id)}
                            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {activeDropdown === u.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
                              <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 shadow-lg">
                                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Change Role</p>
                                {(['ADMIN', 'DEVELOPER', 'USER'] as const).map((role) => (
                                  <button
                                    key={role}
                                    disabled={u.role === role}
                                    onClick={() => handleRoleChange(u.id, role)}
                                    className={cn(
                                      'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                                      u.role === role
                                        ? 'cursor-default text-muted-foreground'
                                        : 'hover:bg-accent',
                                    )}
                                  >
                                    {ROLE_CONFIG[role].label}
                                    {u.role === role && <Check className="ml-auto h-3 w-3" />}
                                  </button>
                                ))}
                                <div className="my-1 h-px bg-border" />
                                <button
                                  onClick={() => handleToggleActive(u.id, u.isActive)}
                                  className={cn(
                                    'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent',
                                    !u.isActive && 'text-green-600',
                                    u.isActive && 'text-destructive',
                                  )}
                                >
                                  {u.isActive ? 'Deactivate' : 'Reactivate'}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border text-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
