'use client';

import { BarChart3 } from 'lucide-react';

export default function AdminOverviewPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: 'Total Users', value: '—', sub: 'Pending Phase 6' },
          { label: 'Conversations', value: '—', sub: 'Pending Phase 4' },
          { label: 'Agents', value: '—', sub: 'Pending Phase 2' },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
