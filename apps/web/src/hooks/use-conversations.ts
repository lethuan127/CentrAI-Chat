'use client';

import { useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { env } from '@/lib/env';

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
  messageCount: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ConversationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface FetchParams {
  page?: number;
  limit?: number;
  search?: string;
  agentId?: string;
  archived?: boolean;
}

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [meta, setMeta] = useState<ConversationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchConversations = useCallback(async (params: FetchParams = {}) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.search) query.set('search', params.search);
      if (params.agentId) query.set('agentId', params.agentId);
      if (params.archived) query.set('archived', 'true');

      const qs = query.toString();
      const res = await apiClient.get<ConversationListItem[]>(
        `/chat/conversations${qs ? `?${qs}` : ''}`,
      );

      if (controller.signal.aborted) return;

      setConversations(res.data);
      if (res.meta) {
        setMeta(res.meta as unknown as ConversationMeta);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

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

  const archiveConversation = useCallback(async (id: string) => {
    await apiClient.patch(`/chat/conversations/${id}/archive`, {});
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const unarchiveConversation = useCallback(async (id: string) => {
    await apiClient.patch(`/chat/conversations/${id}/unarchive`, {});
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const exportConversation = useCallback(async (id: string, format: 'json' | 'md') => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const res = await fetch(
      `${env.apiUrl}/api/v1/chat/conversations/${id}/export?format=${format}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition');
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    const filename = filenameMatch?.[1] ?? `conversation.${format}`;

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return {
    conversations,
    meta,
    isLoading,
    error,
    fetchConversations,
    deleteConversation,
    renameConversation,
    archiveConversation,
    unarchiveConversation,
    exportConversation,
  };
}
