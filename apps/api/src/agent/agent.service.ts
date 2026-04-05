import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma';
import type {
  CreateAgentDto,
  UpdateAgentDto,
  AgentQueryDto,
} from '@centrai/types';
import { AgentStatus } from '../generated/prisma/enums.js';
import type { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAgentDto, userId: string, workspaceId: string) {
    const agent = await this.prisma.agent.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
        role: dto.role,
        instructions: dto.instructions,
        expectedOutput: dto.expectedOutput ?? null,
        modelId: dto.modelId ?? null,
        modelProvider: dto.modelProvider ?? null,
        modelTemperature: dto.modelTemperature ?? 0.7,
        modelMaxTokens: dto.modelMaxTokens ?? null,
        addSessionStateToContext: dto.addSessionStateToContext ?? false,
        maxTurnsMessageHistory: dto.maxTurnsMessageHistory ?? null,
        enableSessionSummaries: dto.enableSessionSummaries ?? false,
        tools: (dto.tools ?? []) as Prisma.InputJsonValue,
        tags: dto.tags ?? [],
        status: AgentStatus.DRAFT,
        version: 1,
        createdBy: userId,
      },
    });

    await this.prisma.agentVersion.create({
      data: {
        agentId: agent.id,
        version: 1,
        name: agent.name,
        description: agent.description,
        role: agent.role,
        instructions: agent.instructions,
        expectedOutput: agent.expectedOutput,
        modelId: agent.modelId,
        modelProvider: agent.modelProvider,
        modelTemperature: agent.modelTemperature,
        modelMaxTokens: agent.modelMaxTokens,
        addSessionStateToContext: agent.addSessionStateToContext,
        maxTurnsMessageHistory: agent.maxTurnsMessageHistory,
        enableSessionSummaries: agent.enableSessionSummaries,
        tools: agent.tools as object,
        tags: agent.tags,
        changelog: 'Initial version',
        createdBy: userId,
      },
    });

    return agent;
  }

  async findAll(query: AgentQueryDto, workspaceId: string) {
    const { search, status, tags, page, limit, sort, order } = query;

    const where: Record<string, unknown> = {
      workspaceId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        where.tags = { hasSome: tagList };
      }
    }

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      items: agents,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, workspaceId: string, version?: number) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (version) {
      const agentVersion = await this.prisma.agentVersion.findUnique({
        where: { agentId_version: { agentId: id, version } },
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      if (!agentVersion) {
        throw new NotFoundException(`Version ${version} not found`);
      }

      return { ...agent, ...agentVersion, id: agent.id };
    }

    return agent;
  }

  async update(id: string, dto: UpdateAgentDto, userId: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.status === AgentStatus.ARCHIVED) {
      throw new BadRequestException('Cannot edit an archived agent');
    }

    const newVersion = agent.version + 1;
    const { changelog, tools, ...updateFields } = dto;

    const data: Record<string, unknown> = { ...updateFields, version: newVersion };
    if (tools !== undefined) {
      data.tools = tools as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedAgent = await tx.agent.update({
        where: { id },
        data,
        include: {
          creator: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.agentVersion.create({
        data: {
          agentId: id,
          version: newVersion,
          name: updatedAgent.name,
          description: updatedAgent.description,
          role: updatedAgent.role,
          instructions: updatedAgent.instructions,
          expectedOutput: updatedAgent.expectedOutput,
          modelId: updatedAgent.modelId,
          modelProvider: updatedAgent.modelProvider,
          modelTemperature: updatedAgent.modelTemperature,
          modelMaxTokens: updatedAgent.modelMaxTokens,
          addSessionStateToContext: updatedAgent.addSessionStateToContext,
          maxTurnsMessageHistory: updatedAgent.maxTurnsMessageHistory,
          enableSessionSummaries: updatedAgent.enableSessionSummaries,
          tools: updatedAgent.tools as object,
          tags: updatedAgent.tags,
          changelog: changelog ?? null,
          createdBy: userId,
        },
      });

      return updatedAgent;
    });

    return updated;
  }

  async publish(id: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.status === AgentStatus.PUBLISHED) {
      throw new BadRequestException('Agent is already published');
    }

    if (agent.status === AgentStatus.ARCHIVED) {
      throw new BadRequestException('Cannot publish an archived agent');
    }

    return this.prisma.agent.update({
      where: { id },
      data: { status: AgentStatus.PUBLISHED },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async archive(id: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agent.update({
      where: { id },
      data: { status: AgentStatus.ARCHIVED },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async unpublish(id: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    if (agent.status !== AgentStatus.PUBLISHED) {
      throw new BadRequestException('Agent is not published');
    }

    return this.prisma.agent.update({
      where: { id },
      data: { status: AgentStatus.DRAFT },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async remove(id: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agent.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findPublished(workspaceId: string) {
    const agents = await this.prisma.agent.findMany({
      where: {
        workspaceId,
        status: AgentStatus.PUBLISHED,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        modelId: true,
        modelProvider: true,
      },
      orderBy: { name: 'asc' },
    });

    return agents;
  }

  async getVersions(id: string, workspaceId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return this.prisma.agentVersion.findMany({
      where: { agentId: id },
      orderBy: { version: 'desc' },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
