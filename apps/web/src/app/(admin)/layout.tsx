'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import {
  Bot,
  Users,
  Server,
  BarChart3,
  ScrollText,
  Settings,
  ArrowLeft,
  Shield,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const adminNav = [
  { href: '/admin', label: 'Overview', icon: BarChart3, exact: true },
  { href: '/admin/agents', label: 'Agents', icon: Bot },
  { href: '/admin/providers', label: 'LLM (env)', icon: Server },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit', label: 'Audit Log', icon: ScrollText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isAdminOrDev = user?.role === 'ADMIN' || user?.role === 'DEVELOPER';

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    } else if (!isLoading && isAuthenticated && !isAdminOrDev) {
      router.replace('/chat');
    }
  }, [isAuthenticated, isLoading, isAdminOrDev, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !isAdminOrDev) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Access Denied</h2>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to access the admin panel.
          </p>
          <Link href="/chat" className="mt-4 inline-block text-primary hover:text-primary/80">
            Go to Chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <aside className="flex w-64 flex-col border-r border-border bg-muted/30">
        <div className="flex h-14 items-center justify-between border-b border-border px-5">
          <span className="text-lg font-bold tracking-tight">Admin</span>
          <Link
            href="/chat"
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="Back to chat"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            if (user?.role === 'DEVELOPER' && (item.href === '/admin/users' || item.href === '/admin/settings')) {
              return null;
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">{user?.name || 'Admin'}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="cursor-pointer rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
