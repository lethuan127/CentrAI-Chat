'use client';

import { useState } from 'react';
import {
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { useAuditLog } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

const RESOURCE_TYPES = ['agent', 'provider', 'user', 'settings', 'conversation'];
const ACTION_HINTS = [
  'agent.create', 'agent.update', 'agent.delete', 'agent.publish',
  'provider.create', 'provider.update', 'provider.delete',
  'user.update', 'user.login',
  'settings.update',
];

function formatTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ActionBadge({ action }: { action: string }) {
  const parts = action.split('.');
  const verb = parts[parts.length - 1] ?? action;
  const colorMap: Record<string, string> = {
    create: 'bg-green-500/10 text-green-600',
    update: 'bg-blue-500/10 text-blue-600',
    delete: 'bg-red-500/10 text-red-600',
    publish: 'bg-purple-500/10 text-purple-600',
    login: 'bg-amber-500/10 text-amber-600',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', colorMap[verb] || 'bg-muted text-muted-foreground')}>
      {action}
    </span>
  );
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const { logs, meta, isLoading, error } = useAuditLog({
    page,
    limit: 50,
    action: actionFilter || undefined,
    resourceType: resourceFilter || undefined,
    status: statusFilter || undefined,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Audit Log</h1>
        {meta && (
          <span className="text-sm text-muted-foreground">({meta.total} events)</span>
        )}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
            showFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:bg-accent',
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
        </button>

        {showFilters && (
          <>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">All Actions</option>
              {ACTION_HINTS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <select
              value={resourceFilter}
              onChange={(e) => { setResourceFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">All Resources</option>
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">All Status</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
            </select>
          </>
        )}
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-destructive">
                    {error}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                    <p className="mt-3 text-sm text-muted-foreground">No audit events recorded yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Actions like creating agents, updating providers, and managing users will appear here.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {formatTimestamp(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{log.actorEmail || log.actorId || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      {log.resourceType ? (
                        <span className="text-sm">
                          <span className="text-muted-foreground">{log.resourceType}</span>
                          {log.resourceId && (
                            <span className="ml-1 font-mono text-xs text-muted-foreground/70">
                              {log.resourceId.slice(0, 8)}…
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-muted-foreground">
                        {log.actorIp || '—'}
                      </span>
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
