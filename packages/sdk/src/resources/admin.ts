import type { CentrAIClient } from '../client.js';
import type {
  User,
  AuditLog,
  AdminUserQueryDto,
  AdminUpdateUserDto,
  UpdateSystemSettingsDto,
  AnalyticsOverview,
  UsageTrendPoint,
  SystemSettings,
  LlmBackendHealth,
  AuditLogQueryDto,
} from '@centrai/types';

interface Envelope<T> { data: T; error: null; meta?: Record<string, unknown> }

export class AdminResource {
  constructor(private client: CentrAIClient) {}

  // ─── Users ─────────────────────────────────────────────────

  async listUsers(query?: Partial<AdminUserQueryDto>): Promise<{ items: User[]; meta: Record<string, unknown> }> {
    const res = await this.client.request<Envelope<User[]>>('GET', '/admin/users', { params: query as Record<string, unknown> });
    return { items: res.data, meta: res.meta ?? {} };
  }

  async updateUser(id: string, dto: AdminUpdateUserDto): Promise<User> {
    const res = await this.client.request<Envelope<User>>('PATCH', `/admin/users/${id}`, { body: dto });
    return res.data;
  }

  // ─── Analytics ─────────────────────────────────────────────

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const res = await this.client.request<Envelope<AnalyticsOverview>>('GET', '/admin/analytics/overview');
    return res.data;
  }

  async getUsageTrend(range: '1d' | '7d' | '30d' | '90d' = '7d'): Promise<UsageTrendPoint[]> {
    const res = await this.client.request<Envelope<UsageTrendPoint[]>>('GET', '/admin/analytics/usage', { params: { range } });
    return res.data;
  }

  // ─── Audit ─────────────────────────────────────────────────

  async getAuditLogs(query?: Partial<AuditLogQueryDto>): Promise<{ items: AuditLog[]; meta: Record<string, unknown> }> {
    const res = await this.client.request<Envelope<AuditLog[]>>('GET', '/admin/audit-log', { params: query as Record<string, unknown> });
    return { items: res.data, meta: res.meta ?? {} };
  }

  // ─── Settings ──────────────────────────────────────────────

  async getSettings(): Promise<SystemSettings> {
    const res = await this.client.request<Envelope<SystemSettings>>('GET', '/admin/settings');
    return res.data;
  }

  async updateSettings(dto: UpdateSystemSettingsDto): Promise<SystemSettings> {
    const res = await this.client.request<Envelope<SystemSettings>>('PATCH', '/admin/settings', { body: dto });
    return res.data;
  }

  // ─── LLM backend health (env) ──────────────────────────────

  async getLlmBackendHealth(): Promise<LlmBackendHealth[]> {
    const res = await this.client.request<Envelope<LlmBackendHealth[]>>('GET', '/admin/llm/health');
    return res.data;
  }
}
