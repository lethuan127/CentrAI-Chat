import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent } from '@mastra/core/agent';
import type { LanguageModel } from 'ai';
import { PrismaService } from '../prisma';
import { AgentStatus } from '../generated/prisma/enums.js';

interface ModelAndSystem {
  model: LanguageModel;
  system: string;
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name);
  private readonly defaultModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.defaultModel = this.config.get<string>('DEFAULT_MODEL', 'openai/gpt-4o-mini');
  }

  async resolveModelAndSystem(
    agentId?: string | null,
    modelId?: string | null,
  ): Promise<ModelAndSystem> {
    if (agentId) {
      const dbAgent = await this.prisma.agent.findFirst({
        where: { id: agentId, status: AgentStatus.PUBLISHED, deletedAt: null },
      });

      if (dbAgent) {
        const modelString = this.resolveModelString(dbAgent.modelId, dbAgent.modelProvider);
        const system = this.buildInstructions(dbAgent);
        const agent = new Agent({ id: `agent-${dbAgent.id}`, name: dbAgent.name, instructions: system, model: modelString });
        return { model: agent.model as LanguageModel, system };
      }
    }

    const modelString = modelId?.includes('/') ? modelId : modelId ? `openai/${modelId}` : this.defaultModel;
    const system = 'You are a helpful AI assistant. Respond clearly and concisely.';
    const agent = new Agent({ id: 'direct-chat', name: 'CentrAI', instructions: system, model: modelString });
    return { model: agent.model as LanguageModel, system };
  }

  async generateTitle(messages: Array<{ role: string; content: string }>): Promise<string> {
    const titleAgent = new Agent({
      id: 'title-generator',
      name: 'Title Generator',
      instructions: 'Generate a concise title (max 6 words) for this conversation. Return ONLY the title text, no quotes or formatting.',
      model: this.defaultModel,
    });

    const summary = messages
      .slice(0, 4)
      .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
      .join('\n');

    try {
      const response = await titleAgent.generate(summary, {
        modelSettings: { temperature: 0.3, maxOutputTokens: 30 },
      });
      return response.text.trim().replace(/^["']|["']$/g, '') || 'New Conversation';
    } catch (err) {
      this.logger.warn(`Title generation failed: ${err instanceof Error ? err.message : err}`);
      return 'New Conversation';
    }
  }

  private resolveModelString(modelId?: string | null, modelProvider?: string | null): string {
    if (modelId && modelId.includes('/')) return modelId;
    if (modelId && modelProvider) return `${modelProvider}/${modelId}`;
    if (modelId) return `openai/${modelId}`;
    return this.defaultModel;
  }

  private buildInstructions(agent: {
    role: string;
    instructions: string;
    expectedOutput?: string | null;
  }): string {
    const parts: string[] = [];
    if (agent.role) parts.push(`# Role\n${agent.role}`);
    if (agent.instructions) parts.push(`# Instructions\n${agent.instructions}`);
    if (agent.expectedOutput) parts.push(`# Expected Output\n${agent.expectedOutput}`);
    return parts.join('\n\n');
  }
}
