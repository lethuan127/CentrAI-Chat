import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { ProviderService } from '../provider';
import { MessageRole, AgentStatus } from '../generated/prisma/enums.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerService: ProviderService,
  ) {}

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

  async listConversations(
    userId: string,
    query: { page: number; limit: number; search?: string },
  ) {
    const where: Record<string, unknown> = { userId, deletedAt: null };

    if (query.search) {
      where.OR = [{ title: { contains: query.search, mode: 'insensitive' } }];
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
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');

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

  async deleteConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { deletedAt: new Date() },
    });
  }

  async updateConversationTitle(conversationId: string, userId: string, title: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }

  async ensureConversation(
    userId: string,
    workspaceId: string,
    dto: { conversationId?: string; agentId?: string; modelId?: string; providerId?: string },
  ): Promise<{ conversationId: string; isNew: boolean }> {
    if (dto.conversationId) {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: dto.conversationId, deletedAt: null },
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
      if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
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

  async persistAssistantMessage(conversationId: string, content: string, tokenCount?: number) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content,
        tokenCount: tokenCount ?? null,
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
