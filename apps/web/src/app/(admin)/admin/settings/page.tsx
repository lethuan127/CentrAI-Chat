'use client';

import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">System Settings</h1>
      </div>
      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Settings className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">System settings are coming in Phase 6.</p>
      </div>
    </div>
  );
}
