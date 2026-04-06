import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ProviderService } from '../provider';
import { MessageRole, AgentStatus } from '../generated/prisma/enums.js';
import type { ConversationQueryDto } from '@centrai/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────

  private async findOwnedConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
    return conversation;
  }

  // ─── Conversation CRUD ──────────────────────────────────────

  async createConversation(
    userId: string,
    workspaceId: string,
    options: { agentId?: string; modelId?: string; providerId?: string; title?: string },
  ) {
    if (options.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: options.agentId, status: AgentStatus.PUBLISHED, deletedAt: null },
      });
      if (!agent) throw new NotFoundException('Published agent not found');
    }

    return this.prisma.conversation.create({
      data: {
        workspaceId,
        userId,
        agentId: options.agentId ?? null,
        modelId: options.modelId ?? null,
        providerId: options.providerId ?? null,
        title: options.title ?? null,
      },
    });
  }

  async listConversations(userId: string, query: ConversationQueryDto) {
    const where: Record<string, unknown> = { userId, deletedAt: null };

    if (query.archived) {
      where.archivedAt = { not: null };
    } else {
      where.archivedAt = null;
    }

    if (query.agentId) where.agentId = query.agentId;
    if (query.modelId) where.modelId = query.modelId;

    if (query.dateFrom || query.dateTo) {
      const createdAt: Record<string, string> = {};
      if (query.dateFrom) createdAt.gte = query.dateFrom;
      if (query.dateTo) createdAt.lte = query.dateTo;
      where.createdAt = createdAt;
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        {
          messages: {
            some: { content: { contains: query.search, mode: 'insensitive' } },
          },
        },
      ];
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          agent: { select: { id: true, name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, role: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      items: conversations.map((c) => ({
        id: c.id,
        title: c.title,
        agentId: c.agentId,
        agentName: c.agent?.name ?? null,
        modelId: c.modelId,
        providerId: c.providerId,
        lastMessage: c.messages[0] ?? null,
        messageCount: c._count.messages,
        archivedAt: c.archivedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: { agent: { select: { id: true, name: true } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
    return conversation;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    query: { page: number; limit: number },
  ) {
    await this.findOwnedConversation(conversationId, userId);

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      items: messages,
      meta: { total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) },
    };
  }

  async updateConversationTitle(conversationId: string, userId: string, title: string) {
    await this.findOwnedConversation(conversationId, userId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  // ─── Delete & Archive ──────────────────────────────────────

  async deleteConversation(conversationId: string, userId: string) {
    await this.findOwnedConversation(conversationId, userId);
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
  }

  async archiveConversation(conversationId: string, userId: string) {
    const conv = await this.findOwnedConversation(conversationId, userId);
    if (conv.archivedAt) throw new ForbiddenException('Already archived');
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { archivedAt: new Date() },
    });
  }

  async unarchiveConversation(conversationId: string, userId: string) {
    const conv = await this.findOwnedConversation(conversationId, userId);
    if (!conv.archivedAt) throw new ForbiddenException('Not archived');
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { archivedAt: null },
    });
  }

  // ─── Export ─────────────────────────────────────────────────

  async exportConversation(conversationId: string, userId: string, format: 'json' | 'md') {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      include: {
        agent: { select: { name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');

    const title = conversation.title || 'Untitled Conversation';

    if (format === 'md') {
      return this.exportAsMarkdown(conversation, title);
    }
    return this.exportAsJson(conversation, title);
  }

  private exportAsJson(
    conversation: {
      id: string;
      title: string | null;
      agent: { name: string } | null;
      modelId: string | null;
      createdAt: Date;
      messages: Array<{ role: string; content: string; createdAt: Date; tokenCount: number | null }>;
    },
    title: string,
  ) {
    const data = {
      title,
      agent: conversation.agent?.name ?? null,
      model: conversation.modelId,
      createdAt: conversation.createdAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        role: m.role.toLowerCase(),
        content: m.content,
        timestamp: m.createdAt.toISOString(),
        ...(m.tokenCount != null ? { tokenCount: m.tokenCount } : {}),
      })),
    };
    return {
      content: JSON.stringify(data, null, 2),
      contentType: 'application/json',
      filename: `${this.slugify(title)}.json`,
    };
  }

  private exportAsMarkdown(
    conversation: {
      id: string;
      title: string | null;
      agent: { name: string } | null;
      modelId: string | null;
      createdAt: Date;
      messages: Array<{ role: string; content: string; createdAt: Date }>;
    },
    title: string,
  ) {
    const lines: string[] = [`# ${title}`, ''];

    if (conversation.agent?.name) lines.push(`**Agent:** ${conversation.agent.name}  `);
    if (conversation.modelId) lines.push(`**Model:** ${conversation.modelId}  `);
    lines.push(`**Date:** ${conversation.createdAt.toISOString()}  `, '---', '');

    for (const msg of conversation.messages) {
      const speaker = msg.role === 'USER' ? '**You**' : msg.role === 'ASSISTANT' ? '**Assistant**' : '**System**';
      lines.push(`### ${speaker}`, '', msg.content, '');
    }

    return {
      content: lines.join('\n'),
      contentType: 'text/markdown',
      filename: `${this.slugify(title)}.md`,
    };
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  // ─── Messaging ──────────────────────────────────────────────

  async ensureConversation(
    userId: string,
    workspaceId: string,
    dto: { conversationId?: string; agentId?: string; modelId?: string; providerId?: string },
  ): Promise<{ conversationId: string; isNew: boolean }> {
    if (dto.conversationId) {
      await this.findOwnedConversation(dto.conversationId, userId);
      return { conversationId: dto.conversationId, isNew: false };
    }

    const conversation = await this.createConversation(userId, workspaceId, {
      agentId: dto.agentId,
      modelId: dto.modelId,
      providerId: dto.providerId,
    });
    return { conversationId: conversation.id, isNew: true };
  }

  async persistUserMessage(conversationId: string, userId: string, content: string) {
    return this.prisma.message.create({
      data: { conversationId, userId, role: MessageRole.USER, content },
    });
  }

  async persistAssistantMessage(
    conversationId: string,
    content: string,
    tokenCount?: number,
    inputTokens?: number,
    outputTokens?: number,
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content,
        tokenCount: tokenCount ?? null,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getConversationHistory(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
      take: 50,
    });
  }

  generateTitleAsync(conversationId: string): void {
    this.prisma.message
      .findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 4,
        select: { role: true, content: true },
      })
      .then((messages) => this.providerService.generateTitle(messages))
      .then(async (title) => {
        if (title && title !== 'New Conversation') {
          await this.prisma.conversation.update({
            where: { id: conversationId },
            data: { title },
          });
        }
      })
      .catch((err: Error) => {
        this.logger.warn(`Auto-title generation failed: ${err.message}`);
      });
  }
}
