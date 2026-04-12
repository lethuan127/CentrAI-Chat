'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import type {
  AnalyticsOverview,
  UsageTrendPoint,
  SystemSettings,
  UpdateSystemSettingsDto,
  LlmBackendHealth,
} from '@centrai/types';

// ─── Analytics ──────────────────────────────────────────────

export function useAnalyticsOverview() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<AnalyticsOverview>('/admin/analytics/overview');
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

export function useUsageTrend(range: string) {
  const [data, setData] = useState<UsageTrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<UsageTrendPoint[]>(`/admin/analytics/usage?range=${range}`);
      setData(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage data');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, error, refetch: fetch };
}

// ─── User Management ────────────────────────────────────────

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: string;
  authProvider: string;
  isActive: boolean;
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  conversationCount: number;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useAdminUsers(params: {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  isActive?: boolean;
  sort?: string;
  order?: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParts: string[] = [
        `page=${params.page}`,
        `limit=${params.limit}`,
      ];
      if (params.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
      if (params.role) queryParts.push(`role=${params.role}`);
      if (params.isActive !== undefined) queryParts.push(`isActive=${params.isActive}`);
      if (params.sort) queryParts.push(`sort=${params.sort}`);
      if (params.order) queryParts.push(`order=${params.order}`);

      const res = await apiClient.get<AdminUser[]>(`/admin/users?${queryParts.join('&')}`);
      setUsers(res.data);
      setMeta((res.meta as unknown as PaginationMeta) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [params.page, params.limit, params.search, params.role, params.isActive, params.sort, params.order]);

  useEffect(() => { fetch(); }, [fetch]);

  const updateUser = useCallback(async (userId: string, data: { role?: string; isActive?: boolean; name?: string }) => {
    const res = await apiClient.patch<AdminUser>(`/admin/users/${userId}`, data);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...res.data } : u)));
    return res.data;
  }, []);

  return { users, meta, isLoading, error, refetch: fetch, updateUser };
}

// ─── Audit Log ──────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorIp: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  status: string;
  createdAt: string;
}

export function useAuditLog(params: {
  page: number;
  limit: number;
  action?: string;
  resourceType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const queryParts: string[] = [
        `page=${params.page}`,
        `limit=${params.limit}`,
      ];
      if (params.action) queryParts.push(`action=${encodeURIComponent(params.action)}`);
      if (params.resourceType) queryParts.push(`resourceType=${params.resourceType}`);
      if (params.status) queryParts.push(`status=${params.status}`);
      if (params.dateFrom) queryParts.push(`dateFrom=${params.dateFrom}`);
      if (params.dateTo) queryParts.push(`dateTo=${params.dateTo}`);

      const res = await apiClient.get<AuditLogEntry[]>(`/admin/audit-log?${queryParts.join('&')}`);
      setLogs(res.data);
      setMeta((res.meta as unknown as PaginationMeta) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }, [params.page, params.limit, params.action, params.resourceType, params.status, params.dateFrom, params.dateTo]);

  useEffect(() => { fetch(); }, [fetch]);

  return { logs, meta, isLoading, error, refetch: fetch };
}

// ─── System Settings ────────────────────────────────────────

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<SystemSettings>('/admin/settings');
      setSettings(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const updateSettings = useCallback(async (dto: UpdateSystemSettingsDto) => {
    setIsSaving(true);
    try {
      const res = await apiClient.patch<SystemSettings>('/admin/settings', dto);
      setSettings(res.data);
      return res.data;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return { settings, isLoading, error, isSaving, refetch: fetch, updateSettings };
}

// ─── LLM backend health ───────────────────────────────────────

export function useLlmBackendHealth() {
  const [health, setHealth] = useState<LlmBackendHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<LlmBackendHealth[]>('/admin/llm/health');
      setHealth(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load LLM health');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { health, isLoading, error, refetch: fetch };
}
