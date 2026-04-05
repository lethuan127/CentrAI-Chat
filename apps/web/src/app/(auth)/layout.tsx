'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/chat');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-primary/5 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="px-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">CentrAI Chat</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Your centralized AI conversation platform.
            <br />
            Chat with published agents and enabled models.
          </p>
        </div>
      </div>
      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">{children}</div>
    </div>
  );
}
