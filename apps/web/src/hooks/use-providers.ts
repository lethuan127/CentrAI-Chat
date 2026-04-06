'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ProviderModelItem {
  id: string;
  modelId: string;
  name: string;
  contextWindow: number | null;
  isEnabled: boolean;
  capabilities: Record<string, unknown>;
}

export interface ProviderItem {
  id: string;
  name: string;
  type: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  isEnabled: boolean;
  config: Record<string, unknown>;
  enabledModelCount: number;
  totalModelCount: number;
  models: ProviderModelItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EnabledModelGroup {
  providerId: string;
  providerName: string;
  providerType: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow: number | null;
    capabilities: Record<string, unknown>;
  }>;
}

export function useProviders() {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<ProviderItem[]>('/providers?limit=100');
      setProviders(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch providers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProvider = useCallback(async (data: {
    name: string;
    type: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    isEnabled?: boolean;
  }) => {
    const res = await apiClient.post<ProviderItem>('/providers', data);
    setProviders((prev) => [res.data, ...prev]);
    return res.data;
  }, []);

  const updateProvider = useCallback(async (id: string, data: {
    name?: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    isEnabled?: boolean;
  }) => {
    const res = await apiClient.patch<ProviderItem>(`/providers/${id}`, data);
    setProviders((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    return res.data;
  }, []);

  const deleteProvider = useCallback(async (id: string) => {
    await apiClient.delete(`/providers/${id}`);
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const testConnection = useCallback(async (id: string) => {
    const res = await apiClient.post<{ ok: boolean; message: string; models?: string[] }>(
      `/providers/${id}/test`,
      {},
    );
    return res.data;
  }, []);

  const syncModels = useCallback(async (id: string) => {
    const res = await apiClient.post<ProviderItem>(`/providers/${id}/sync`, {});
    setProviders((prev) => prev.map((p) => (p.id === id ? res.data : p)));
    return res.data;
  }, []);

  const toggleModel = useCallback(async (providerId: string, modelId: string, isEnabled: boolean) => {
    await apiClient.patch(`/providers/${providerId}/models/${modelId}`, { isEnabled });
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id !== providerId) return p;
        return {
          ...p,
          enabledModelCount: p.enabledModelCount + (isEnabled ? 1 : -1),
          models: p.models.map((m) =>
            m.modelId === modelId ? { ...m, isEnabled } : m,
          ),
        };
      }),
    );
  }, []);

  return {
    providers,
    isLoading,
    error,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    testConnection,
    syncModels,
    toggleModel,
  };
}

export function useEnabledModels() {
  const [models, setModels] = useState<EnabledModelGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<EnabledModelGroup[]>('/providers/enabled-models');
      setModels(res.data);
    } catch {
      // Silently fail — the picker will just be empty
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { models, isLoading, fetchModels };
}
