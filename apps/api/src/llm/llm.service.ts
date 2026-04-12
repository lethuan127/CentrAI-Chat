import { runtimeAgentDefinitionFromPersisted, type RuntimeAgentDefinition } from '@centrai/agent';
import {
  LLM_BACKEND_LABELS,
  LLM_MODEL_CATALOG,
  type EnabledLlmModelGroup,
  type LlmBackendHealth,
  type LlmCatalogModel,
} from '@centrai/types';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ToolLoopAgent, type LanguageModel } from 'ai';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma';
import { AgentStatus } from '../generated/prisma/enums.js';

interface ModelAndDefinition {
  model: LanguageModel;
  definition: RuntimeAgentDefinition;
}

const BACKEND_KEYS = ['openai', 'anthropic', 'google', 'ollama', 'custom'] as const;

function isBackendKey(s: string): s is (typeof BACKEND_KEYS)[number] {
  return (BACKEND_KEYS as readonly string[]).includes(s);
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly defaultModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultModel = this.config.get<string>('DEFAULT_MODEL', 'openai/gpt-4o-mini');
  }

  async resolveModelAndDefinition(
    agentId?: string | null,
    modelId?: string | null,
    modelProviderHint?: string | null,
  ): Promise<ModelAndDefinition> {
    if (agentId) {
      const dbAgent = await this.prisma.agent.findFirst({
        where: { id: agentId, status: AgentStatus.PUBLISHED, deletedAt: null },
      });

      if (dbAgent) {
        const definition = runtimeAgentDefinitionFromPersisted(dbAgent);
        const model = this.resolveLanguageModel(dbAgent.modelId, dbAgent.modelProvider);
        return { model, definition };
      }
    }

    const definition = runtimeAgentDefinitionFromPersisted({
      name: 'CentrAI Chat',
      description: null,
      role: 'AI Assistant',
      instructions:
        'You are a helpful AI assistant in CentrAI-Chat, an open-source centralized AI conversation platform. ' +
        'Respond clearly and concisely.',
      expectedOutput: null,
      tools: null,
      addSessionStateToContext: false,
      maxTurnsMessageHistory: null,
      modelId: modelId ?? null,
      modelProvider: modelProviderHint ?? null,
    });
    const model = this.resolveLanguageModel(modelId, modelProviderHint);
    return { model, definition };
  }

  private resolveLanguageModel(modelId?: string | null, modelProviderHint?: string | null): LanguageModel {
    const modelString = this.resolveModelString(modelId, modelProviderHint);
    const fromEnv = this.createLanguageModelFromEnvString(modelString);
    if (fromEnv) return fromEnv;

    throw new ServiceUnavailableException(
      'No LLM credentials available for this model. Set the matching API key in the API environment ' +
        '(e.g. OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY) and use a model id like openai/gpt-4o-mini.',
    );
  }

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
      case 'custom': {
        const apiKey = this.config.get<string>('CUSTOM_OPENAI_API_KEY')?.trim() || this.config.get<string>('OPENAI_API_KEY')?.trim();
        const baseURL = this.config.get<string>('CUSTOM_OPENAI_BASE_URL')?.trim();
        if (!apiKey || !baseURL) return null;
        return createOpenAI({ apiKey, baseURL })(mid);
      }
      default:
        return null;
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

  getEnabledModelGroups(): EnabledLlmModelGroup[] {
    const groups: EnabledLlmModelGroup[] = [];

    for (const key of BACKEND_KEYS) {
      if (!this.isBackendConfigured(key)) continue;
      const catalog = LLM_MODEL_CATALOG[key] ?? [];
      if (catalog.length === 0 && key !== 'ollama') continue;

      groups.push({
        backendKey: key,
        backendName: LLM_BACKEND_LABELS[key] ?? key,
        backendType: key,
        models:
          key === 'ollama'
            ? [{ id: 'llama3.2', name: 'Ollama (example)', contextWindow: null, capabilities: {} }]
            : catalog.map((m: LlmCatalogModel) => ({
                id: `${key}/${m.id}`,
                name: m.name,
                contextWindow: m.contextWindow,
                capabilities: m.capabilities,
              })),
      });
    }

    return groups;
  }

  private isBackendConfigured(key: (typeof BACKEND_KEYS)[number]): boolean {
    switch (key) {
      case 'openai':
        return Boolean(this.config.get<string>('OPENAI_API_KEY')?.trim());
      case 'anthropic':
        return Boolean(this.config.get<string>('ANTHROPIC_API_KEY')?.trim());
      case 'google':
        return Boolean(this.config.get<string>('GOOGLE_API_KEY')?.trim());
      case 'ollama':
        return true;
      case 'custom': {
        const apiKey =
          this.config.get<string>('CUSTOM_OPENAI_API_KEY')?.trim() ||
          this.config.get<string>('OPENAI_API_KEY')?.trim();
        const base = this.config.get<string>('CUSTOM_OPENAI_BASE_URL')?.trim();
        return Boolean(apiKey && base);
      }
      default:
        return false;
    }
  }

  async getBackendHealthList(): Promise<LlmBackendHealth[]> {
    const results: LlmBackendHealth[] = [];

    for (const key of BACKEND_KEYS) {
      const configured = this.isBackendConfigured(key);
      const catalog = LLM_MODEL_CATALOG[key] ?? [];
      const catalogModels = key === 'ollama' ? 1 : catalog.length;

      if (!configured) {
        results.push({
          backendKey: key,
          displayName: LLM_BACKEND_LABELS[key] ?? key,
          isConfigured: false,
          status: 'unknown',
          latencyMs: null,
          lastChecked: new Date().toISOString(),
          catalogModels,
        });
        continue;
      }

      const start = Date.now();
      let status: LlmBackendHealth['status'] = 'unknown';
      let errorMessage: string | undefined;
      try {
        const r = await this.probeBackend(key);
        status = r.ok ? 'healthy' : 'down';
        if (!r.ok) errorMessage = r.message;
      } catch (err) {
        status = 'down';
        errorMessage = err instanceof Error ? err.message : 'Connection failed';
      }

      results.push({
        backendKey: key,
        displayName: LLM_BACKEND_LABELS[key] ?? key,
        isConfigured: true,
        status,
        latencyMs: Date.now() - start,
        lastChecked: new Date().toISOString(),
        catalogModels,
        errorMessage,
      });
    }

    return results;
  }

  private async probeBackend(
    key: (typeof BACKEND_KEYS)[number],
  ): Promise<{ ok: boolean; message: string }> {
    switch (key) {
      case 'openai':
      case 'custom': {
        const apiKey =
          key === 'custom'
            ? this.config.get<string>('CUSTOM_OPENAI_API_KEY')?.trim() ||
              this.config.get<string>('OPENAI_API_KEY')?.trim()
            : this.config.get<string>('OPENAI_API_KEY')?.trim();
        const baseUrl =
          key === 'custom'
            ? this.config.get<string>('CUSTOM_OPENAI_BASE_URL')?.trim()
            : this.config.get<string>('OPENAI_BASE_URL')?.trim() || 'https://api.openai.com/v1';
        return this.testOpenAICompatible(apiKey, baseUrl);
      }
      case 'anthropic': {
        const apiKey = this.config.get<string>('ANTHROPIC_API_KEY')?.trim();
        if (!apiKey) return { ok: false, message: 'Missing ANTHROPIC_API_KEY' };
        return this.testAnthropic(apiKey);
      }
      case 'google': {
        const apiKey = this.config.get<string>('GOOGLE_API_KEY')?.trim();
        if (!apiKey) return { ok: false, message: 'Missing GOOGLE_API_KEY' };
        return this.testGoogle(apiKey);
      }
      case 'ollama': {
        const baseUrl = this.config.get<string>('OLLAMA_BASE_URL')?.trim() || 'http://localhost:11434';
        return this.testOllama(baseUrl);
      }
      default:
        return { ok: false, message: 'Unknown backend' };
    }
  }

  private async testOpenAICompatible(
    apiKey?: string,
    baseUrl?: string | null,
  ): Promise<{ ok: boolean; message: string }> {
    const url = `${baseUrl || 'https://api.openai.com/v1'}/models`;
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, message: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = (await res.json()) as { data?: Array<{ id: string }> };
    const n = (data.data ?? []).length;
    return { ok: true, message: `Connected. ${n}+ models listed.` };
  }

  private async testAnthropic(apiKey: string): Promise<{ ok: boolean; message: string }> {
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
    return { ok: true, message: 'Reachable' };
  }

  private async testGoogle(apiKey: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );
    if (!res.ok) {
      if (res.status === 400 || res.status === 403) return { ok: false, message: 'Invalid API key' };
      return { ok: false, message: `HTTP ${res.status}` };
    }
    return { ok: true, message: 'Connected to Google AI API.' };
  }

  private async testOllama(baseUrl: string): Promise<{ ok: boolean; message: string }> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/tags`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, message: `Ollama returned HTTP ${res.status}` };
    return { ok: true, message: 'Connected to Ollama.' };
  }

  countConfiguredBackends(): number {
    return BACKEND_KEYS.filter((k) => this.isBackendConfigured(k)).length;
  }

  private resolveModelString(modelId?: string | null, modelProviderHint?: string | null): string {
    if (modelId && modelId.includes('/')) return modelId;
    if (modelId && modelProviderHint && isBackendKey(modelProviderHint.toLowerCase())) {
      return `${modelProviderHint.toLowerCase()}/${modelId}`;
    }
    if (modelId) return `openai/${modelId}`;
    const fallback = this.defaultModel;
    if (fallback.includes('/')) return fallback;
    return `openai/${fallback}`;
  }

}
