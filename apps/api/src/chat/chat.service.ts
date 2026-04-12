import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import { LlmService } from '../llm';
import { MessageRole, AgentStatus } from '../generated/prisma/enums.js';
import type { ConversationQueryDto } from '@centrai/types';
import type { Message as MessageRow } from '../generated/prisma/client.js';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────

  async findOwnedConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');
    return conversation;
  }

  /**
   * Light validation for browser-reported IANA time zone ids (e.g. America/New_York).
   */
  private sanitizeClientTimeZone(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const t = raw.trim();
    if (t.length === 0 || t.length > 120) return null;
    if (!/^[\w/+.:-]+$/.test(t)) return null;
    return t;
  }

  /**
   * Session block prepended to the model system instructions: user name/email from the DB,
   * client time zone, and "now" formatted in that zone (server clock).
   */
  async buildChatSessionPreamble(userId: string, clientTimeZoneRaw?: unknown): Promise<string> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { name: true, email: true },
    });
    if (!user) {
      return '';
    }

    const displayName = user.name?.trim() || 'Not set';
    const lines: string[] = [
      '[Session context — use for user- and time-aware replies; do not recite unless relevant]',
      `- User name: ${displayName}`,
      `- User email: ${user.email}`,
    ];

    const tz = this.sanitizeClientTimeZone(clientTimeZoneRaw);
    const now = new Date();

    if (tz) {
      try {
        const localTime = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZoneName: 'short',
        }).format(now);
        lines.push(`- User local timezone: ${tz}`);
        lines.push(`- Current time in user's timezone: ${localTime}`);
      } catch {
        lines.push('- User local timezone: (invalid; ignored)');
        lines.push(`- Current time (UTC, ISO): ${now.toISOString()}`);
      }
    } else {
      lines.push('- User local timezone: (not provided)');
      lines.push(`- Current time (UTC, ISO): ${now.toISOString()}`);
    }

    return lines.join('\n');
  }

  // ─── Conversation CRUD ──────────────────────────────────────

  async createConversation(
    userId: string,
    workspaceId: string,
    options: { agentId?: string; modelId?: string; modelProvider?: string; title?: string },
  ) {
    if (options.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: options.agentId, status: AgentStatus.PUBLISHED, deletedAt: null },
      });
      if (!agent) throw new NotFoundException('Published agent not found');
    }

    let modelId = options.modelId ?? null;
    if (modelId && !modelId.includes('/') && options.modelProvider?.trim()) {
      modelId = `${options.modelProvider.trim().toLowerCase()}/${modelId}`;
    }

    return this.prisma.conversation.create({
      data: {
        workspaceId,
        userId,
        agentId: options.agentId ?? null,
        modelId,
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

    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, deletedAt: null },
      select: {
        activeLeafMessageId: true,
        modelId: true,
        agentId: true,
      },
    });

    const agentName =
      conv?.agentId != null
        ? (
            await this.prisma.agent.findFirst({
              where: { id: conv.agentId },
              select: { name: true },
            })
          )?.name ?? null
        : null;

    const take = Math.min(query.limit, 500);
    const all = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take,
    });

    const total = await this.prisma.message.count({ where: { conversationId } });
    const path = this.buildMessagePath(all, conv?.activeLeafMessageId ?? null);
    const effectiveLeaf = path.length > 0 ? path[path.length - 1]!.id : null;

    return {
      items: path,
      meta: {
        total,
        page: 1,
        limit: path.length,
        totalPages: 1,
        activeLeafMessageId: effectiveLeaf,
        allMessages: all,
        modelId: conv?.modelId ?? null,
        agentName,
      },
    };
  }

  /**
   * Ordered messages along the active branch (root → leaf). Legacy rows with no parent_id
   * are treated as a single chronological thread.
   */
  buildMessagePath(all: MessageRow[], activeLeafMessageId: string | null): MessageRow[] {
    const legacyLinear = all.length > 0 && all.every((m) => m.parentId == null);
    if (legacyLinear) {
      return [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    const byId = new Map(all.map((m) => [m.id, m]));
    let leaf =
      activeLeafMessageId != null && byId.has(activeLeafMessageId) ? activeLeafMessageId : null;
    if (leaf == null && all.length > 0) {
      const sorted = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      leaf = sorted[sorted.length - 1]!.id;
    }
    if (leaf == null) return [];

    const path: MessageRow[] = [];
    let cur: string | null = leaf;
    while (cur) {
      const msg = byId.get(cur);
      if (!msg) break;
      path.push(msg);
      cur = msg.parentId;
    }
    path.reverse();
    return path;
  }

  deepestLeafFromMessage(startId: string, all: MessageRow[]): string {
    const children = new Map<string | null, MessageRow[]>();
    for (const m of all) {
      const key = m.parentId;
      if (!children.has(key)) children.set(key, []);
      children.get(key)!.push(m);
    }
    for (const [, arr] of children) {
      arr.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }

    let cur = startId;
    while (true) {
      const kids = children.get(cur) ?? [];
      if (kids.length === 0) return cur;
      cur = kids[kids.length - 1]!.id;
    }
  }

  async setActiveLeafFromFocusMessage(conversationId: string, userId: string, focusMessageId: string) {
    await this.findOwnedConversation(conversationId, userId);

    const all = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 500,
    });

    if (!all.some((m) => m.id === focusMessageId)) {
      throw new NotFoundException('Message not found');
    }

    const leafId = this.deepestLeafFromMessage(focusMessageId, all);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { activeLeafMessageId: leafId, updatedAt: new Date() },
    });

    return { activeLeafMessageId: leafId };
  }

  async findAssistantMessage(messageId: string, conversationId: string) {
    return this.prisma.message.findFirst({
      where: { id: messageId, conversationId, role: MessageRole.ASSISTANT },
      select: { id: true, parentId: true },
    });
  }

  async assertUserMessageInConversation(messageId: string, conversationId: string) {
    const m = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, role: MessageRole.USER },
    });
    if (!m) throw new BadRequestException('Invalid user message for regeneration');
    return m.id;
  }

  /**
   * Edit user message for **branching** resend: update text, keep every direct assistant reply to this
   * user message (sibling variants), delete only continuations *under* those assistants (and any non-assistant
   * junk directly after the user in legacy threads). Next stream should use branchFromAssistantMessageId.
   */
  async editUserMessageContent(
    conversationId: string,
    userId: string,
    messageId: string,
    content: string,
  ) {
    await this.findOwnedConversation(conversationId, userId);

    const msg = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.role !== MessageRole.USER) {
      throw new BadRequestException('Only user messages can be edited');
    }
    if (msg.userId !== userId) {
      throw new ForbiddenException('Not your message');
    }

    const all = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });

    const legacyLinear = all.length > 0 && all.every((m) => m.parentId == null);
    let toDelete: string[];

    if (legacyLinear) {
      const sorted = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const editIdx = sorted.findIndex((m) => m.id === messageId);
      if (editIdx === -1) throw new NotFoundException('Message not found');
      let firstAssistantIdx = -1;
      for (let i = editIdx + 1; i < sorted.length; i++) {
        if (sorted[i]!.role === MessageRole.ASSISTANT) {
          firstAssistantIdx = i;
          break;
        }
      }
      if (firstAssistantIdx === -1) {
        toDelete = sorted.slice(editIdx + 1).map((m) => m.id);
      } else {
        toDelete = sorted.slice(firstAssistantIdx + 1).map((m) => m.id);
      }
    } else {
      const byParent = new Map<string | null, string[]>();
      for (const m of all) {
        const p = m.parentId;
        if (!byParent.has(p)) byParent.set(p, []);
        byParent.get(p)!.push(m.id);
      }
      const byId = new Map(all.map((m) => [m.id, m]));
      const directAssistantIds = (byParent.get(messageId) ?? []).filter((childId) => {
        return byId.get(childId)?.role === MessageRole.ASSISTANT;
      });
      const toDeleteSet = new Set<string>();
      const collectDescendants = (nodeId: string) => {
        for (const childId of byParent.get(nodeId) ?? []) {
          collectDescendants(childId);
          toDeleteSet.add(childId);
        }
      };
      for (const aid of directAssistantIds) {
        collectDescendants(aid);
      }
      toDelete = [...toDeleteSet];
    }

    await this.prisma.$transaction(async (tx) => {
      if (toDelete.length > 0) {
        await tx.message.deleteMany({ where: { id: { in: toDelete }, conversationId } });
      }
      await tx.message.update({
        where: { id: messageId },
        data: { content },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { activeLeafMessageId: messageId, updatedAt: new Date() },
      });
    });

    return { id: messageId, content, conversationId };
  }

  async resolveBranchAssistantParent(conversationId: string, branchFromAssistantMessageId: string) {
    const m = await this.prisma.message.findFirst({
      where: { id: branchFromAssistantMessageId, conversationId },
    });
    if (!m || m.role !== MessageRole.ASSISTANT) {
      throw new BadRequestException('Invalid branch anchor message');
    }
    if (m.parentId == null) {
      throw new BadRequestException('Cannot branch from this message');
    }
    const parent = await this.prisma.message.findFirst({
      where: { id: m.parentId, conversationId },
    });
    if (!parent || parent.role !== MessageRole.USER) {
      throw new BadRequestException('Invalid branch anchor message');
    }
    return parent.id;
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
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    if (conversation.userId !== userId) throw new ForbiddenException('Not your conversation');

    const all = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: 2000,
    });
    const path = this.buildMessagePath(all, conversation.activeLeafMessageId);

    const title = conversation.title || 'Untitled Conversation';
    const payload = { ...conversation, messages: path };

    if (format === 'md') {
      return this.exportAsMarkdown(payload, title);
    }
    return this.exportAsJson(payload, title);
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
    dto: { conversationId?: string; agentId?: string; modelId?: string; modelProvider?: string },
  ): Promise<{ conversationId: string; isNew: boolean }> {
    if (dto.conversationId) {
      await this.findOwnedConversation(dto.conversationId, userId);
      return { conversationId: dto.conversationId, isNew: false };
    }

    const conversation = await this.createConversation(userId, workspaceId, {
      agentId: dto.agentId,
      modelId: dto.modelId,
      modelProvider: dto.modelProvider,
    });
    return { conversationId: conversation.id, isNew: true };
  }

  async persistUserMessage(
    conversationId: string,
    userId: string,
    content: string,
    parentMessageId: string | null,
  ) {
    const userMsg = await this.prisma.message.create({
      data: {
        conversationId,
        userId,
        role: MessageRole.USER,
        content,
        parentId: parentMessageId,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { activeLeafMessageId: userMsg.id, updatedAt: new Date() },
    });

    return userMsg;
  }

  async persistAssistantMessage(
    conversationId: string,
    content: string,
    parentUserMessageId: string,
    tokenCount?: number,
    inputTokens?: number,
    outputTokens?: number,
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.ASSISTANT,
        content,
        parentId: parentUserMessageId,
        tokenCount: tokenCount ?? null,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { activeLeafMessageId: message.id, updatedAt: new Date() },
    });

    return message;
  }

  async updateAssistantMessage(
    messageId: string,
    conversationId: string,
    content: string,
    tokenCount?: number,
    inputTokens?: number,
    outputTokens?: number,
  ) {
    const existing = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, role: MessageRole.ASSISTANT },
    });
    if (!existing) throw new NotFoundException('Assistant message not found');

    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: {
        content,
        tokenCount: tokenCount ?? null,
        inputTokens: inputTokens ?? null,
        outputTokens: outputTokens ?? null,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { activeLeafMessageId: message.id, updatedAt: new Date() },
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
    Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }),
      this.prisma.conversation.findFirst({
        where: { id: conversationId },
        select: { activeLeafMessageId: true },
      }),
    ])
      .then(([all, conv]) => {
        const path = this.buildMessagePath(all, conv?.activeLeafMessageId ?? null);
        return path.slice(0, 4).map((m) => ({ role: m.role, content: m.content }));
      })
      .then((messages) => this.llmService.generateTitle(messages))
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
