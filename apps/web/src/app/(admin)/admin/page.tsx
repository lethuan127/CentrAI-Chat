'use client';

import { useState } from 'react';
import {
  BarChart3,
  Users,
  MessageSquare,
  Bot,
  Server,
  Zap,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { useAnalyticsOverview, useUsageTrend, useLlmBackendHealth } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

type Range = '1d' | '7d' | '30d' | '90d';

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className={cn('h-4 w-4', accent || 'text-muted-foreground')} />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function MiniChart({ data, dataKey }: { data: { date: string; [key: string]: unknown }[]; dataKey: string }) {
  if (!data.length) return null;

  const values = data.map((d) => Number(d[dataKey]) || 0);
  const max = Math.max(...values, 1);
  const barCount = data.length;

  return (
    <div className="flex items-end gap-px" style={{ height: 64 }}>
      {data.map((d, i) => {
        const val = Number(d[dataKey]) || 0;
        const h = Math.max((val / max) * 100, 2);
        return (
          <div
            key={d.date}
            className="flex-1 rounded-t bg-primary/60 transition-all hover:bg-primary"
            style={{ height: `${h}%`, minWidth: barCount > 30 ? 2 : 4 }}
            title={`${d.date}: ${val.toLocaleString()}`}
          />
        );
      })}
    </div>
  );
}

function LlmBackendHealthCards() {
  const { health, isLoading } = useLlmBackendHealth();

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted/40" />
        ))}
      </div>
    );
  }

  if (!health.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No LLM backend data returned.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {health.map((p) => (
        <div
          key={p.backendKey}
          className="flex items-center gap-3 rounded-lg border border-border p-4"
        >
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              p.status === 'healthy' && 'bg-green-500',
              p.status === 'degraded' && 'bg-yellow-500',
              p.status === 'down' && 'bg-red-500',
              p.status === 'unknown' && 'bg-muted-foreground/40',
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {p.backendKey}
              {p.isConfigured ? ` · ${p.catalogModels} catalog models` : ' · not configured'}
              {p.latencyMs != null && ` · ${p.latencyMs}ms`}
            </p>
          </div>
          {!p.isConfigured && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              No env key
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [range, setRange] = useState<Range>('7d');
  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview();
  const { data: trend, isLoading: trendLoading } = useUsageTrend(range);

  const fmt = (n: number | undefined) => (n ?? 0).toLocaleString();

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      {/* Overview Cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted/40" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Users"
              value={fmt(overview?.totalUsers)}
              sub={`${fmt(overview?.activeUsers)} active`}
              icon={Users}
              accent="text-blue-500"
            />
            <StatCard
              label="Conversations"
              value={fmt(overview?.totalConversations)}
              sub={`${fmt(overview?.todayConversations)} today`}
              icon={MessageSquare}
              accent="text-green-500"
            />
            <StatCard
              label="Messages"
              value={fmt(overview?.totalMessages)}
              sub={`${fmt(overview?.todayMessages)} today`}
              icon={TrendingUp}
              accent="text-purple-500"
            />
            <StatCard
              label="Tokens Used"
              value={fmt(overview?.totalTokens)}
              sub={`${fmt(overview?.todayTokens)} today`}
              icon={Zap}
              accent="text-amber-500"
            />
            <StatCard
              label="Agents"
              value={fmt(overview?.totalAgents)}
              sub={`${fmt(overview?.publishedAgents)} published`}
              icon={Bot}
              accent="text-cyan-500"
            />
            <StatCard
              label="LLM backends (env)"
              value={fmt(overview?.configuredLlmBackends)}
              sub="with API keys set"
              icon={Server}
              accent="text-orange-500"
            />
          </>
        )}
      </div>

      {/* Usage Trend */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Usage Trend</h2>
          <div className="flex gap-1 rounded-lg border border-border p-0.5">
            {(['1d', '7d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  range === r
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {trendLoading ? (
          <div className="mt-4 h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">Conversations</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {trend.reduce((s, d) => s + d.conversations, 0).toLocaleString()}
              </p>
              <div className="mt-3">
                <MiniChart data={trend as unknown as { [key: string]: unknown; date: string }[]} dataKey="conversations" />
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">Messages</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {trend.reduce((s, d) => s + d.messages, 0).toLocaleString()}
              </p>
              <div className="mt-3">
                <MiniChart data={trend as unknown as { [key: string]: unknown; date: string }[]} dataKey="messages" />
              </div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground">Tokens</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {trend.reduce((s, d) => s + d.tokens, 0).toLocaleString()}
              </p>
              <div className="mt-3">
                <MiniChart data={trend as unknown as { [key: string]: unknown; date: string }[]} dataKey="tokens" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LLM backend health */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">LLM backends</h2>
        </div>
        <div className="mt-4">
          <LlmBackendHealthCards />
        </div>
      </div>
    </div>
  );
}
