'use client';

import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface ConversationListItem {
  id: string;
  title: string | null;
  agentId: string | null;
  agentName: string | null;
  modelId: string | null;
  providerId: string | null;
  lastMessage: {
    content: string;
    role: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(
    async (params: { page?: number; limit?: number; search?: string } = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams();
        if (params.page) query.set('page', String(params.page));
        if (params.limit) query.set('limit', String(params.limit));
        if (params.search) query.set('search', params.search);

        const qs = query.toString();
        const res = await apiClient.get<ConversationListItem[]>(
          `/chat/conversations${qs ? `?${qs}` : ''}`,
        );
        setConversations(res.data);
        if (res.meta) {
          setMeta(res.meta as unknown as ConversationMeta);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const deleteConversation = useCallback(async (id: string) => {
    await apiClient.delete(`/chat/conversations/${id}`);
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    await apiClient.patch(`/chat/conversations/${id}`, { title });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  return {
    conversations,
    meta,
    isLoading,
    error,
    fetchConversations,
    deleteConversation,
    renameConversation,
  };
}
