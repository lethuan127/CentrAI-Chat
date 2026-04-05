'use client';

import { Bot } from 'lucide-react';

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Agents</h1>
        </div>
      </div>
      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Bot className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Agent management is coming in Phase 2.</p>
      </div>
    </div>
  );
}
