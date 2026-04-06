import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { PrismaService } from '../prisma';
import { encrypt, decrypt } from '../common/crypto';
import type { ProviderType } from '../generated/prisma/enums.js';
import type {
  CreateProviderDto,
  UpdateProviderDto,
  ProviderQueryDto,
} from '@centrai/types';

interface WellKnownModel {
  id: string;
  name: string;
  contextWindow: number | null;
  capabilities: Record<string, boolean>;
}

const WELL_KNOWN_MODELS: Record<string, WellKnownModel[]> = {
  OPENAI: [
    { id: 'gpt-5.4', name: 'GPT-5.4', contextWindow: 1050000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', contextWindow: 400000, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-5.4-nano', name: 'GPT-5.4 Nano', contextWindow: 400000, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-5', name: 'GPT-5', contextWindow: 400000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', contextWindow: 400000, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-4.1', name: 'GPT-4.1', contextWindow: 1047576, capabilities: { vision: true, function_calling: true } },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', contextWindow: 1047576, capabilities: { vision: true, function_calling: true } },
    { id: 'o3', name: 'o3', contextWindow: 200000, capabilities: { reasoning: true, vision: true, function_calling: true } },
    { id: 'o4-mini', name: 'o4-mini', contextWindow: 200000, capabilities: { reasoning: true, function_calling: true } },
  ],
  ANTHROPIC: [
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', contextWindow: 1000000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', contextWindow: 1000000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', contextWindow: 200000, capabilities: { vision: true, function_calling: true } },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', contextWindow: 200000, capabilities: { vision: true, function_calling: true, reasoning: true } },
  ],
  GOOGLE: [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', contextWindow: 1000000, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', contextWindow: 1000000, capabilities: { vision: true, function_calling: true } },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash-Lite', contextWindow: 1000000, capabilities: { vision: true, function_calling: true } },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576, capabilities: { vision: true, function_calling: true, reasoning: true } },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', contextWindow: 1048576, capabilities: { vision: true, function_calling: true } },
  ],
  OLLAMA: [],
  CUSTOM: [],
};

@Injectable()
export class ProviderAdminService {
  private readonly logger = new Logger(ProviderAdminService.name);
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.encryptionKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
  }

  // ─── CRUD ────────────────────────────────────────────────

  async create(workspaceId: string, dto: CreateProviderDto) {
    const apiKeyEncrypted = dto.apiKey
      ? encrypt(dto.apiKey, this.encryptionKey)
      : null;

    const provider = await this.prisma.provider.create({
      data: {
        workspaceId,
        name: dto.name,
        type: dto.type as ProviderType,
        baseUrl: dto.baseUrl ?? null,
        apiKeyEncrypted,
        isEnabled: dto.isEnabled,
        config: (dto.config ?? {}) as Record<string, never>,
      },
    });

    const wellKnown = WELL_KNOWN_MODELS[dto.type] ?? [];
    if (wellKnown.length > 0) {
      await this.prisma.providerModel.createMany({
        data: wellKnown.map((m) => ({
          providerId: provider.id,
          modelId: m.id,
          name: m.name,
          contextWindow: m.contextWindow,
          capabilities: m.capabilities,
          isEnabled: false,
        })),
      });
    }

    return this.findById(provider.id);
  }

  async findAll(workspaceId: string, query: ProviderQueryDto) {
    const where: Record<string, unknown> = { workspaceId };
    if (query.type) where.type = query.type;

    const [providers, total] = await Promise.all([
      this.prisma.provider.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          models: { orderBy: { name: 'asc' } },
          _count: { select: { models: { where: { isEnabled: true } } } },
        },
      }),
      this.prisma.provider.count({ where }),
    ]);

    return {
      items: providers.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        baseUrl: p.baseUrl,
        hasApiKey: !!p.apiKeyEncrypted,
        isEnabled: p.isEnabled,
        config: p.config,
        enabledModelCount: p._count.models,
        totalModelCount: p.models.length,
        models: p.models,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findById(id: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: { models: { orderBy: { name: 'asc' } } },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    return {
      id: provider.id,
      workspaceId: provider.workspaceId,
      name: provider.name,
      type: provider.type,
      baseUrl: provider.baseUrl,
      hasApiKey: !!provider.apiKeyEncrypted,
      isEnabled: provider.isEnabled,
      config: provider.config,
      models: provider.models,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  async update(id: string, dto: UpdateProviderDto) {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.baseUrl !== undefined) data.baseUrl = dto.baseUrl;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;
    if (dto.config !== undefined) data.config = dto.config;
    if (dto.apiKey !== undefined) {
      data.apiKeyEncrypted = dto.apiKey
        ? encrypt(dto.apiKey, this.encryptionKey)
        : null;
    }

    await this.prisma.provider.update({ where: { id }, data });
    return this.findById(id);
  }

  async remove(id: string) {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    await this.prisma.provider.delete({ where: { id } });
  }

  // ─── Model Management ───────────────────────────────────

  async toggleModel(providerId: string, modelId: string, isEnabled: boolean) {
    const model = await this.prisma.providerModel.findUnique({
      where: { providerId_modelId: { providerId, modelId } },
    });
    if (!model) throw new NotFoundException('Model not found');

    return this.prisma.providerModel.update({
      where: { id: model.id },
      data: { isEnabled },
    });
  }

  async syncModels(providerId: string) {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { models: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    if (provider.type === 'OLLAMA') {
      return this.syncOllamaModels(provider);
    }

    const wellKnown = WELL_KNOWN_MODELS[provider.type] ?? [];
    const existing = new Set(provider.models.map((m) => m.modelId));
    const toCreate = wellKnown.filter((m) => !existing.has(m.id));

    if (toCreate.length > 0) {
      await this.prisma.providerModel.createMany({
        data: toCreate.map((m) => ({
          providerId,
          modelId: m.id,
          name: m.name,
          contextWindow: m.contextWindow,
          capabilities: m.capabilities,
          isEnabled: false,
        })),
      });
    }

    return this.findById(providerId);
  }

  private async syncOllamaModels(
    provider: { id: string; baseUrl: string | null; models: Array<{ modelId: string }> },
  ) {
    const baseUrl = provider.baseUrl || 'http://localhost:11434';

    try {
      const res = await fetch(`${baseUrl}/api/tags`);
      if (!res.ok) throw new Error(`Ollama API returned ${res.status}`);

      const data = (await res.json()) as { models?: Array<{ name: string }> };
      const remoteModels = data.models ?? [];
      const existing = new Set(provider.models.map((m) => m.modelId));

      const toCreate = remoteModels
        .filter((m) => !existing.has(m.name))
        .map((m) => ({
          providerId: provider.id,
          modelId: m.name,
          name: m.name,
          contextWindow: null,
          capabilities: {},
          isEnabled: false,
        }));

      if (toCreate.length > 0) {
        await this.prisma.providerModel.createMany({ data: toCreate });
      }
    } catch (err) {
      this.logger.warn(`Ollama model sync failed: ${err instanceof Error ? err.message : err}`);
      throw new BadRequestException('Failed to connect to Ollama. Is it running?');
    }

    return this.findById(provider.id);
  }

  // ─── Test Connection ─────────────────────────────────────

  async testConnection(id: string): Promise<{ ok: boolean; message: string; models?: string[] }> {
    const provider = await this.prisma.provider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');

    const apiKey = provider.apiKeyEncrypted
      ? decrypt(provider.apiKeyEncrypted, this.encryptionKey)
      : undefined;

    try {
      switch (provider.type) {
        case 'OPENAI':
        case 'CUSTOM':
          return this.testOpenAICompatible(apiKey, provider.baseUrl);
        case 'ANTHROPIC':
          return this.testAnthropic(apiKey);
        case 'GOOGLE':
          return this.testGoogle(apiKey);
        case 'OLLAMA':
          return this.testOllama(provider.baseUrl);
        default:
          return { ok: false, message: `Unknown provider type: ${provider.type}` };
      }
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : 'Connection failed' };
    }
  }

  private async testOpenAICompatible(
    apiKey?: string,
    baseUrl?: string | null,
  ): Promise<{ ok: boolean; message: string; models?: string[] }> {
    const url = `${baseUrl || 'https://api.openai.com/v1'}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const models = (data.data ?? []).map((m) => m.id).slice(0, 20);
    return { ok: true, message: `Connected. Found ${models.length}+ models.`, models };
  }

  private async testAnthropic(apiKey?: string): Promise<{ ok: boolean; message: string }> {
    if (!apiKey) return { ok: false, message: 'API key is required for Anthropic' };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (res.ok || res.status === 200) {
      return { ok: true, message: 'Connected to Anthropic API.' };
    }

    if (res.status === 401) return { ok: false, message: 'Invalid API key' };
    return { ok: true, message: 'Connected to Anthropic API.' };
  }

  private async testGoogle(apiKey?: string): Promise<{ ok: boolean; message: string }> {
    if (!apiKey) return { ok: false, message: 'API key is required for Google' };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );

    if (!res.ok) {
      if (res.status === 400 || res.status === 403) return { ok: false, message: 'Invalid API key' };
      return { ok: false, message: `HTTP ${res.status}` };
    }

    return { ok: true, message: 'Connected to Google AI API.' };
  }

  private async testOllama(baseUrl?: string | null): Promise<{ ok: boolean; message: string; models?: string[] }> {
    const url = `${baseUrl || 'http://localhost:11434'}/api/tags`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: `Ollama returned HTTP ${res.status}` };

    const data = (await res.json()) as { models?: Array<{ name: string }> };
    const models = (data.models ?? []).map((m) => m.name);
    return { ok: true, message: `Connected. Found ${models.length} models.`, models };
  }

  // ─── Enabled Models (for end-user chat picker) ────────────

  async getEnabledModels(workspaceId: string) {
    const providers = await this.prisma.provider.findMany({
      where: { workspaceId, isEnabled: true },
      include: {
        models: {
          where: { isEnabled: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    return providers
      .filter((p) => p.models.length > 0)
      .map((p) => ({
        providerId: p.id,
        providerName: p.name,
        providerType: p.type,
        models: p.models.map((m) => ({
          id: m.modelId,
          name: m.name,
          contextWindow: m.contextWindow,
          capabilities: m.capabilities,
        })),
      }));
  }

  getApiKey(provider: { apiKeyEncrypted: string | null }): string | undefined {
    if (!provider.apiKeyEncrypted) return undefined;
    return decrypt(provider.apiKeyEncrypted, this.encryptionKey);
  }
}
