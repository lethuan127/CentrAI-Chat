import { buildSystemPrompt, runtimeAgentDefinitionFromPersisted } from '@centrai/agent';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ToolLoopAgent, type LanguageModel } from 'ai';
import { PrismaService } from '../prisma';
import { decrypt } from '../common/crypto';
import { AgentStatus } from '../generated/prisma/enums.js';

interface ModelAndSystem {
  model: LanguageModel;
  system: string;
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  private readonly defaultModel: string;
  private readonly encryptionKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultModel = this.config.get<string>('DEFAULT_MODEL', 'openai/gpt-4o-mini');
    this.encryptionKey = this.config.get<string>('ENCRYPTION_KEY', '');
  }

  async resolveModelAndSystem(
    agentId?: string | null,
    modelId?: string | null,
    providerId?: string | null,
  ): Promise<ModelAndSystem> {
    if (agentId) {
      const dbAgent = await this.prisma.agent.findFirst({
        where: { id: agentId, status: AgentStatus.PUBLISHED, deletedAt: null },
      });

      if (dbAgent) {
        const system = this.buildInstructions(dbAgent);
        const model = await this.resolveLanguageModel(
          dbAgent.modelId,
          dbAgent.modelProvider,
        );
        return { model, system };
      }
    }

    const system =
      'You are a helpful AI assistant in CentrAI-Chat, an open-source centralized AI conversation platform. ' +
      'Respond clearly and concisely.';
    const model = await this.resolveLanguageModel(modelId, providerId);
    return { model, system };
  }

  private async resolveLanguageModel(
    modelId?: string | null,
    providerId?: string | null,
  ): Promise<LanguageModel> {
    // Try DB-configured provider first
    if (providerId && modelId) {
      const dbModel = await this.tryResolveFromDb(providerId, modelId);
      if (dbModel) return dbModel;
    }

    // If modelId looks like "provider/model", try to resolve from DB by provider type
    if (modelId?.includes('/')) {
      const dbModel = await this.tryResolveFromModelString(modelId);
      if (dbModel) return dbModel;
    }

    // Fall back to env-based resolution (direct SDK providers — not Vercel AI Gateway)
    const modelString = this.resolveModelString(modelId, providerId);
    const fromEnv = this.createLanguageModelFromEnvString(modelString);
    if (fromEnv) return fromEnv;

    throw new ServiceUnavailableException(
      'No LLM credentials available. Configure a provider in admin or set OPENAI_API_KEY ' +
        '(and OPENAI_BASE_URL if not using api.openai.com) in the API environment.',
    );
  }

  private async tryResolveFromDb(
    providerId: string,
    modelId: string,
  ): Promise<LanguageModel | null> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
    });
    if (!provider || !provider.isEnabled) return null;

    const apiKey = provider.apiKeyEncrypted && this.encryptionKey
      ? decrypt(provider.apiKeyEncrypted, this.encryptionKey)
      : undefined;

    return this.createLanguageModel(provider.type, modelId, apiKey, provider.baseUrl);
  }

  private async tryResolveFromModelString(
    modelString: string,
  ): Promise<LanguageModel | null> {
    const [providerHint, ...rest] = modelString.split('/');
    const modelId = rest.join('/');
    if (!modelId) return null;

    const typeMap: Record<string, string> = {
      openai: 'OPENAI',
      anthropic: 'ANTHROPIC',
      google: 'GOOGLE',
      ollama: 'OLLAMA',
    };

    const providerType = typeMap[providerHint.toLowerCase()];
    if (!providerType) return null;

    const provider = await this.prisma.provider.findFirst({
      where: { type: providerType as never, isEnabled: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!provider) return null;

    const apiKey = provider.apiKeyEncrypted && this.encryptionKey
      ? decrypt(provider.apiKeyEncrypted, this.encryptionKey)
      : undefined;

    return this.createLanguageModel(provider.type, modelId, apiKey, provider.baseUrl);
  }

  /** Resolves `provider/model` using API process env vars (.env.example documents these). */
  private createLanguageModelFromEnvString(modelString: string): LanguageModel | null {
    const slash = modelString.indexOf('/');
    if (slash <= 0) return null;
    const providerHint = modelString.slice(0, slash).toLowerCase();
    const mid = modelString.slice(slash + 1);
    if (!mid) return null;

    switch (providerHint) {
      case 'openai': {
        const apiKey = this.config.get<string>('OPENAI_API_KEY')?.trim();
        if (!apiKey) return null;
        const baseURL = this.config.get<string>('OPENAI_BASE_URL')?.trim() || undefined;
        const openai = createOpenAI({
          apiKey,
          ...(baseURL ? { baseURL } : {}),
        });
        return openai(mid);
      }
      case 'anthropic': {
        const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
        if (!apiKey) return null;
        return createAnthropic({ apiKey })(mid);
      }
      case 'google': {
        const apiKey = this.config.get<string>('GOOGLE_API_KEY')?.trim();
        if (!apiKey) return null;
        return createGoogleGenerativeAI({ apiKey })(mid);
      }
      case 'ollama': {
        const baseURL =
          this.config.get<string>('OLLAMA_BASE_URL')?.trim() ||
          this.config.get<string>('OPENAI_BASE_URL')?.trim() ||
          'http://localhost:11434/v1';
        return createOpenAI({ apiKey: 'ollama', baseURL })(mid);
      }
      default:
        return null;
    }
  }

  private createLanguageModel(
    providerType: string,
    modelId: string,
    apiKey?: string,
    baseUrl?: string | null,
  ): LanguageModel {
    switch (providerType) {
      case 'OPENAI': {
        const openai = createOpenAI({
          apiKey,
          ...(baseUrl ? { baseURL: baseUrl } : {}),
        });
        return openai(modelId);
      }
      case 'ANTHROPIC': {
        const anthropic = createAnthropic({ apiKey });
        return anthropic(modelId);
      }
      case 'GOOGLE': {
        const google = createGoogleGenerativeAI({ apiKey });
        return google(modelId);
      }
      case 'OLLAMA': {
        const ollama = createOpenAI({
          apiKey: 'ollama',
          baseURL: baseUrl || 'http://localhost:11434/v1',
        });
        return ollama(modelId);
      }
      case 'CUSTOM': {
        const custom = createOpenAI({
          apiKey: apiKey || '',
          ...(baseUrl ? { baseURL: baseUrl } : {}),
        });
        return custom(modelId);
      }
      default: {
        const fallback = createOpenAI({ apiKey });
        return fallback(modelId);
      }
    }
  }

  async generateTitle(messages: Array<{ role: string; content: string }>): Promise<string> {
    const modelString = this.resolveModelString();
    const model = this.createLanguageModelFromEnvString(modelString);
    if (!model) {
      this.logger.warn('Title generation skipped: no env LLM credentials for default model');
      return 'New Conversation';
    }

    const summary = messages
      .slice(0, 4)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    try {
      const titleAgent = new ToolLoopAgent({
        id: 'centrai-title',
        model,
        instructions:
          'Generate a concise title (max 6 words) for this conversation. Return ONLY the title text, no quotes or formatting.',
        temperature: 0.3,
        maxOutputTokens: 30,
      });
      const output = await titleAgent.generate({ prompt: summary });
      const text = output.text;
      return text.trim().replace(/^["']|["']$/g, '') || 'New Conversation';
    } catch (err) {
      this.logger.warn(
        `Title generation failed: ${err instanceof Error ? err.message : err}`,
      );
      return 'New Conversation';
    }
  }

  private resolveModelString(
    modelId?: string | null,
    modelProvider?: string | null,
  ): string {
    if (modelId && modelId.includes('/')) return modelId;
    if (modelId && modelProvider) return `${modelProvider}/${modelId}`;
    if (modelId) return `openai/${modelId}`;
    const fallback = this.defaultModel;
    if (fallback.includes('/')) return fallback;
    return `openai/${fallback}`;
  }

  private buildInstructions(agent: {
    name: string;
    description: string | null;
    role: string;
    instructions: string;
    expectedOutput: string | null;
    tools: unknown;
    addSessionStateToContext: boolean;
    maxTurnsMessageHistory: number | null;
  }): string {
    return buildSystemPrompt(
      runtimeAgentDefinitionFromPersisted({
        name: agent.name,
        description: agent.description,
        role: agent.role,
        instructions: agent.instructions,
        expectedOutput: agent.expectedOutput,
        tools: agent.tools,
        addSessionStateToContext: agent.addSessionStateToContext,
        maxTurnsMessageHistory: agent.maxTurnsMessageHistory,
      }),
    );
  }
}
