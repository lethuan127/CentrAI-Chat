'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/spinner';
import { AgentForm } from '@/components/admin/agent-form';
import { useAgents } from '@/hooks/use-agents';
import type { AgentListItem } from '@/hooks/use-agents';

export default function EditAgentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getAgent } = useAgents();
  const [agent, setAgent] = useState<AgentListItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setIsLoading(true);
    getAgent(params.id)
      .then(setAgent)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load agent'))
      .finally(() => setIsLoading(false));
  }, [params.id, getAgent]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <p className="text-destructive">{error || 'Agent not found'}</p>
        <button
          onClick={() => router.push('/admin/agents')}
          className="mt-4 text-sm text-primary hover:underline"
        >
          Back to Agents
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Edit Agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Editing creates a new version. Previous versions are preserved.
      </p>
      <div className="mt-8">
        <AgentForm agent={agent} />
      </div>
    </div>
  );
}
