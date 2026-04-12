import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { LlmService } from '../llm/llm.service';
import type {
  AdminUserQueryDto,
  AdminUpdateUserDto,
  AnalyticsOverview,
  UsageTrendPoint,
  AuditLogQueryDto,
  SystemSettings,
  UpdateSystemSettingsDto,
  LlmBackendHealth,
} from '@centrai/types';
import type { Role } from '../generated/prisma/enums.js';

const SYSTEM_SETTINGS_DEFAULTS: SystemSettings = {
  defaultModel: 'openai/gpt-4o-mini',
  defaultProvider: '',
  registrationEnabled: true,
  maxConversationsPerUser: 1000,
  maxMessagesPerConversation: 500,
  rateLimitPerMinute: 60,
  maintenanceMode: false,
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly llmService: LlmService,
  ) {}

  // ─── User Management ──────────────────────────────────────

  async listUsers(workspaceId: string, query: AdminUserQueryDto) {
    const where: Record<string, unknown> = { workspaceId, deletedAt: null };

    if (query.role) where.role = query.role;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const orderBy = { [query.sort]: query.order } as Record<string, string>;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          role: true,
          authProvider: true,
          isActive: true,
          emailVerified: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { conversations: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => ({
        ...u,
        conversationCount: u._count.conversations,
        _count: undefined,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async updateUser(userId: string, dto: AdminUpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const data: Record<string, unknown> = {};
    if (dto.role !== undefined) data.role = dto.role as Role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.name !== undefined) data.name = dto.name;

    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
        authProvider: true,
        isActive: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ─── Analytics ─────────────────────────────────────────────

  async getAnalyticsOverview(workspaceId: string): Promise<AnalyticsOverview> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      activeUsers,
      totalConversations,
      totalMessages,
      tokenAgg,
      todayConversations,
      todayMessages,
      todayTokenAgg,
      totalAgents,
      publishedAgents,
    ] = await Promise.all([
      this.prisma.user.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.user.count({ where: { workspaceId, isActive: true, deletedAt: null } }),
      this.prisma.conversation.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.message.count({
        where: { conversation: { workspaceId, deletedAt: null } },
      }),
      this.prisma.message.aggregate({
        where: { conversation: { workspaceId, deletedAt: null } },
        _sum: { tokenCount: true },
      }),
      this.prisma.conversation.count({
        where: { workspaceId, deletedAt: null, createdAt: { gte: startOfToday } },
      }),
      this.prisma.message.count({
        where: {
          conversation: { workspaceId, deletedAt: null },
          createdAt: { gte: startOfToday },
        },
      }),
      this.prisma.message.aggregate({
        where: {
          conversation: { workspaceId, deletedAt: null },
          createdAt: { gte: startOfToday },
        },
        _sum: { tokenCount: true },
      }),
      this.prisma.agent.count({ where: { workspaceId, deletedAt: null } }),
      this.prisma.agent.count({ where: { workspaceId, deletedAt: null, status: 'PUBLISHED' } }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalConversations,
      totalMessages,
      totalTokens: tokenAgg._sum.tokenCount ?? 0,
      todayConversations,
      todayMessages,
      todayTokens: todayTokenAgg._sum.tokenCount ?? 0,
      totalAgents,
      publishedAgents,
      configuredLlmBackends: this.llmService.countConfiguredBackends(),
    };
  }

  async getUsageTrend(workspaceId: string, range: string): Promise<UsageTrendPoint[]> {
    const days = range === '1d' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const conversations = await this.prisma.$queryRawUnsafe<
      Array<{ date: string; count: bigint }>
    >(
      `SELECT DATE(c."createdAt") as date, COUNT(*)::bigint as count
       FROM conversations c
       JOIN workspaces w ON c."workspaceId" = w.id
       WHERE c."workspaceId" = $1 AND c."deletedAt" IS NULL AND c."createdAt" >= $2
       GROUP BY DATE(c."createdAt") ORDER BY date`,
      workspaceId,
      since,
    );

    const messages = await this.prisma.$queryRawUnsafe<
      Array<{ date: string; count: bigint; tokens: bigint }>
    >(
      `SELECT DATE(m."createdAt") as date, COUNT(*)::bigint as count,
              COALESCE(SUM(m."tokenCount"), 0)::bigint as tokens
       FROM messages m
       JOIN conversations c ON m."conversationId" = c.id
       WHERE c."workspaceId" = $1 AND c."deletedAt" IS NULL AND m."createdAt" >= $2
       GROUP BY DATE(m."createdAt") ORDER BY date`,
      workspaceId,
      since,
    );

    const convMap = new Map(conversations.map((r) => [r.date, Number(r.count)]));
    const msgMap = new Map(messages.map((r) => [r.date, { count: Number(r.count), tokens: Number(r.tokens) }]));

    const result: UsageTrendPoint[] = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0]!;
      const msg = msgMap.get(key);
      result.push({
        date: key,
        conversations: convMap.get(key) ?? 0,
        messages: msg?.count ?? 0,
        tokens: msg?.tokens ?? 0,
      });
    }

    return result;
  }

  // ─── Audit Log ─────────────────────────────────────────────

  async getAuditLogs(workspaceId: string, query: AuditLogQueryDto) {
    const where: Record<string, unknown> = { workspaceId };

    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (query.resourceType) where.resourceType = query.resourceType;
    if (query.status) where.status = query.status;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, string> = {};
      if (query.dateFrom) createdAt.gte = query.dateFrom;
      if (query.dateTo) createdAt.lte = query.dateTo;
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: logs,
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async writeAuditLog(params: {
    workspaceId: string;
    actorId?: string;
    actorEmail?: string;
    actorIp?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    status?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          workspaceId: params.workspaceId,
          actorId: params.actorId ?? null,
          actorEmail: params.actorEmail ?? null,
          actorIp: params.actorIp ?? null,
          action: params.action,
          resourceType: params.resourceType ?? null,
          resourceId: params.resourceId ?? null,
          metadata: (params.metadata ?? {}) as Record<string, never>,
          status: params.status ?? 'success',
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ─── System Settings ──────────────────────────────────────

  async getSystemSettings(workspaceId: string): Promise<SystemSettings> {
    const rows = await this.prisma.systemSetting.findMany({ where: { workspaceId } });
    const settings = { ...SYSTEM_SETTINGS_DEFAULTS };

    for (const row of rows) {
      const key = row.key as keyof SystemSettings;
      if (key in settings) {
        (settings as Record<string, unknown>)[key] = row.value;
      }
    }

    return settings;
  }

  async updateSystemSettings(workspaceId: string, dto: UpdateSystemSettingsDto): Promise<SystemSettings> {
    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);

    for (const [key, value] of entries) {
      await this.prisma.systemSetting.upsert({
        where: { workspaceId_key: { workspaceId, key } },
        update: { value: value as never },
        create: { workspaceId, key, value: value as never },
      });
    }

    return this.getSystemSettings(workspaceId);
  }

  // ─── Provider Health ──────────────────────────────────────

  async getLlmBackendHealth(_workspaceId: string): Promise<LlmBackendHealth[]> {
    return this.llmService.getBackendHealthList();
  }
}
