import type { CentrAIClient } from '../client.js';
import type {
  Provider,
  ProviderModel,
  CreateProviderDto,
  UpdateProviderDto,
  ProviderQueryDto,
} from '@centrai/types';

interface Envelope<T> { data: T; error: null; meta?: Record<string, unknown> }

export interface EnabledModelsGroup {
  providerId: string;
  providerName: string;
  providerType: string;
  models: ProviderModel[];
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  modelsFound: number;
  error: string | null;
}

export class ProvidersResource {
  constructor(private client: CentrAIClient) {}

  async create(dto: CreateProviderDto): Promise<Provider> {
    const res = await this.client.request<Envelope<Provider>>('POST', '/providers', { body: dto });
    return res.data;
  }

  async list(query?: Partial<ProviderQueryDto>): Promise<{ items: Provider[]; meta: Record<string, unknown> }> {
    const res = await this.client.request<Envelope<Provider[]>>('GET', '/providers', { params: query as Record<string, unknown> });
    return { items: res.data, meta: res.meta ?? {} };
  }

  async getEnabledModels(): Promise<EnabledModelsGroup[]> {
    const res = await this.client.request<Envelope<EnabledModelsGroup[]>>('GET', '/providers/enabled-models');
    return res.data;
  }

  async get(id: string): Promise<Provider> {
    const res = await this.client.request<Envelope<Provider>>('GET', `/providers/${id}`);
    return res.data;
  }

  async update(id: string, dto: UpdateProviderDto): Promise<Provider> {
    const res = await this.client.request<Envelope<Provider>>('PATCH', `/providers/${id}`, { body: dto });
    return res.data;
  }

  async delete(id: string): Promise<void> {
    await this.client.request('DELETE', `/providers/${id}`);
  }

  async testConnection(id: string): Promise<TestConnectionResult> {
    const res = await this.client.request<Envelope<TestConnectionResult>>('POST', `/providers/${id}/test`);
    return res.data;
  }

  async syncModels(id: string): Promise<Provider> {
    const res = await this.client.request<Envelope<Provider>>('POST', `/providers/${id}/sync`);
    return res.data;
  }

  async toggleModel(providerId: string, modelId: string, isEnabled: boolean): Promise<ProviderModel> {
    const res = await this.client.request<Envelope<ProviderModel>>('PATCH', `/providers/${providerId}/models/${modelId}`, {
      body: { isEnabled },
    });
    return res.data;
  }
}
