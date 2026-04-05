'use client';

import { Users } from 'lucide-react';

export default function UsersPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Users</h1>
      </div>
      <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <Users className="h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">User management is coming in Phase 6.</p>
      </div>
    </div>
  );
}
