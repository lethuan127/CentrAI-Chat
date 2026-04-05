'use client';

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import type { AgentStatus } from '@centrai/types';

export interface AgentCreator {
  id: string;
  name: string | null;
  email: string;
}

export interface AgentListItem {
  id: string;
  name: string;
  description: string | null;
  role: string;
  instructions: string;
  expectedOutput: string | null;
  modelId: string | null;
  modelProvider: string | null;
  modelTemperature: number;
  modelMaxTokens: number | null;
  addSessionStateToContext: boolean;
  maxTurnsMessageHistory: number | null;
  enableSessionSummaries: boolean;
  tools: unknown[];
  tags: string[];
  status: AgentStatus;
  version: number;
  createdBy: string;
  creator: AgentCreator;
  createdAt: string;
  updatedAt: string;
}

export interface AgentVersion {
  id: string;
  agentId: string;
  version: number;
  name: string;
  description: string | null;
  role: string;
  instructions: string;
  expectedOutput: string | null;
  modelId: string | null;
  modelProvider: string | null;
  modelTemperature: number;
  modelMaxTokens: number | null;
  addSessionStateToContext: boolean;
  maxTurnsMessageHistory: number | null;
  enableSessionSummaries: boolean;
  tools: unknown[];
  tags: string[];
  changelog: string | null;
  createdBy: string;
  creator: AgentCreator;
  createdAt: string;
}

interface AgentListMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface AgentQueryParams {
  search?: string;
  status?: AgentStatus;
  tags?: string;
  page?: number;
  limit?: number;
  sort?: 'name' | 'createdAt' | 'updatedAt' | 'version';
  order?: 'asc' | 'desc';
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [meta, setMeta] = useState<AgentListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async (params: AgentQueryParams = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params.search) query.set('search', params.search);
      if (params.status) query.set('status', params.status);
      if (params.tags) query.set('tags', params.tags);
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.sort) query.set('sort', params.sort);
      if (params.order) query.set('order', params.order);

      const qs = query.toString();
      const res = await apiClient.get<AgentListItem[]>(`/agents${qs ? `?${qs}` : ''}`);
      setAgents(res.data);
      if (res.meta) {
        setMeta(res.meta as unknown as AgentListMeta);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createAgent = useCallback(async (data: {
    name: string;
    description?: string;
    role: string;
    instructions: string;
    expectedOutput?: string;
    modelId?: string;
    modelProvider?: string;
    modelTemperature?: number;
    modelMaxTokens?: number;
    addSessionStateToContext?: boolean;
    maxTurnsMessageHistory?: number;
    enableSessionSummaries?: boolean;
    tools?: unknown[];
    tags?: string[];
  }) => {
    const res = await apiClient.post<AgentListItem>('/agents', data);
    return res.data;
  }, []);

  const updateAgent = useCallback(async (id: string, data: {
    name?: string;
    description?: string | null;
    role?: string;
    instructions?: string;
    expectedOutput?: string | null;
    modelId?: string | null;
    modelProvider?: string | null;
    modelTemperature?: number;
    modelMaxTokens?: number | null;
    addSessionStateToContext?: boolean;
    maxTurnsMessageHistory?: number | null;
    enableSessionSummaries?: boolean;
    tools?: unknown[];
    tags?: string[];
    changelog?: string;
  }) => {
    const res = await apiClient.patch<AgentListItem>(`/agents/${id}`, data);
    return res.data;
  }, []);

  const getAgent = useCallback(async (id: string) => {
    const res = await apiClient.get<AgentListItem>(`/agents/${id}`);
    return res.data;
  }, []);

  const getVersions = useCallback(async (id: string) => {
    const res = await apiClient.get<AgentVersion[]>(`/agents/${id}/versions`);
    return res.data;
  }, []);

  const publishAgent = useCallback(async (id: string) => {
    const res = await apiClient.post<AgentListItem>(`/agents/${id}/publish`, {});
    return res.data;
  }, []);

  const unpublishAgent = useCallback(async (id: string) => {
    const res = await apiClient.post<AgentListItem>(`/agents/${id}/unpublish`, {});
    return res.data;
  }, []);

  const archiveAgent = useCallback(async (id: string) => {
    const res = await apiClient.post<AgentListItem>(`/agents/${id}/archive`, {});
    return res.data;
  }, []);

  const deleteAgent = useCallback(async (id: string) => {
    await apiClient.delete(`/agents/${id}`);
  }, []);

  return {
    agents,
    meta,
    isLoading,
    error,
    fetchAgents,
    createAgent,
    updateAgent,
    getAgent,
    getVersions,
    publishAgent,
    unpublishAgent,
    archiveAgent,
    deleteAgent,
  };
}
