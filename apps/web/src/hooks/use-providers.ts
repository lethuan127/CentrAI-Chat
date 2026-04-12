'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface EnabledModelGroup {
  backendKey: string;
  backendName: string;
  backendType: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow: number | null;
    capabilities: Record<string, unknown>;
  }>;
}

export function useEnabledModels() {
  const [models, setModels] = useState<EnabledModelGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<EnabledModelGroup[]>('/chat/enabled-models');
      setModels(res.data);
    } catch {
      // Picker stays empty if the API is unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { models, isLoading, fetchModels };
}
