'use client';

import { useAuth } from '@/hooks/use-auth';
import { Settings } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="mt-8 space-y-6">
        <div className="rounded-lg border border-border p-6">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Name</label>
              <p className="mt-1">{user?.name || 'Not set'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Email</label>
              <p className="mt-1">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground">Role</label>
              <p className="mt-1 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-sm font-medium text-primary">
                {user?.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
