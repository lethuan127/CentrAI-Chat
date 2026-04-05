'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface PublishedAgentItem {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  modelId: string | null;
  modelProvider: string | null;
}

export function usePublishedAgents() {
  const [agents, setAgents] = useState<PublishedAgentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<PublishedAgentItem[]>('/agents/published');
      setAgents(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return { agents, isLoading, error, refetch: fetchAgents };
}
