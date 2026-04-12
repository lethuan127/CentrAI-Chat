import type { CentrAIClient } from '../client.js';
import type {
  Agent,
  PublishedAgent,
  AgentVersion,
  CreateAgentDto,
  UpdateAgentDto,
  AgentQueryDto,
  ToolkitInfo,
} from '@centrai/types';

interface Envelope<T> { data: T; error: null; meta?: Record<string, unknown> }

export class AgentsResource {
  constructor(private client: CentrAIClient) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    const res = await this.client.request<Envelope<Agent>>('POST', '/agents', { body: dto });
    return res.data;
  }

  async list(query?: Partial<AgentQueryDto>): Promise<{ items: Agent[]; meta: Record<string, unknown> }> {
    const res = await this.client.request<Envelope<Agent[]>>('GET', '/agents', { params: query as Record<string, unknown> });
    return { items: res.data, meta: res.meta ?? {} };
  }

  async listPublished(): Promise<PublishedAgent[]> {
    const res = await this.client.request<Envelope<PublishedAgent[]>>('GET', '/agents/published');
    return res.data;
  }

  /**
   * Returns the catalog of built-in toolkits that can be attached to an agent.
   * Use `name` from each entry as the value stored in `tools[].name` when
   * creating or updating an agent.
   */
  async listTools(): Promise<ToolkitInfo[]> {
    const res = await this.client.request<Envelope<ToolkitInfo[]>>('GET', '/agents/tools');
    return res.data;
  }

  async get(id: string, version?: number): Promise<Agent> {
    const res = await this.client.request<Envelope<Agent>>('GET', `/agents/${id}`, {
      params: version !== undefined ? { version } : {},
    });
    return res.data;
  }

  async update(id: string, dto: UpdateAgentDto): Promise<Agent> {
    const res = await this.client.request<Envelope<Agent>>('PATCH', `/agents/${id}`, { body: dto });
    return res.data;
  }

  async publish(id: string): Promise<Agent> {
    const res = await this.client.request<Envelope<Agent>>('POST', `/agents/${id}/publish`);
    return res.data;
  }

  async archive(id: string): Promise<Agent> {
    const res = await this.client.request<Envelope<Agent>>('POST', `/agents/${id}/archive`);
    return res.data;
  }

  async unpublish(id: string): Promise<Agent> {
    const res = await this.client.request<Envelope<Agent>>('POST', `/agents/${id}/unpublish`);
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/agents/${id}`);
  }

  async getVersions(id: string): Promise<AgentVersion[]> {
    const res = await this.client.request<Envelope<AgentVersion[]>>('GET', `/agents/${id}/versions`);
    return res.data;
  }
}
