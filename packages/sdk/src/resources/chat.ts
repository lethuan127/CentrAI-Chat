import type { CentrAIClient } from '../client.js';
import type {
  Conversation,
  Message,
  CreateConversationDto,
  ConversationQueryDto,
  MessageQueryDto,
  EnabledLlmModelGroup,
} from '@centrai/types';

interface Envelope<T> { data: T; error: null; meta?: Record<string, unknown> }

export interface SendMessageOptions {
  messages: Array<{ role: string; content: string; id?: string }>;
  conversationId?: string;
  agentId?: string;
  modelId?: string;
  modelProvider?: string;
}

export class ChatResource {
  constructor(private client: CentrAIClient) {}

  async createConversation(dto: CreateConversationDto): Promise<Conversation> {
    const res = await this.client.request<Envelope<Conversation>>('POST', '/chat/conversations', { body: dto });
    return res.data;
  }

  async listConversations(query?: Partial<ConversationQueryDto>): Promise<{ items: Conversation[]; meta: Record<string, unknown> }> {
    const res = await this.client.request<Envelope<Conversation[]>>('GET', '/chat/conversations', { params: query as Record<string, unknown> });
    return { items: res.data, meta: res.meta ?? {} };
  }

  async getConversation(id: string): Promise<Conversation> {
    const res = await this.client.request<Envelope<Conversation>>('GET', `/chat/conversations/${id}`);
    return res.data;
  }

  async getMessages(conversationId: string, query?: Partial<MessageQueryDto>): Promise<{ items: Message[]; meta: Record<string, unknown> }> {
    const res = await this.client.request<Envelope<Message[]>>('GET', `/chat/conversations/${conversationId}/messages`, { params: query as Record<string, unknown> });
    return { items: res.data, meta: res.meta ?? {} };
  }

  async updateTitle(id: string, title: string): Promise<Conversation> {
    const res = await this.client.request<Envelope<Conversation>>('PATCH', `/chat/conversations/${id}`, { body: { title } });
    return res.data;
  }

  async deleteConversation(id: string): Promise<void> {
    await this.client.request('DELETE', `/chat/conversations/${id}`);
  }

  async archive(id: string): Promise<Conversation> {
    const res = await this.client.request<Envelope<Conversation>>('PATCH', `/chat/conversations/${id}/archive`);
    return res.data;
  }

  async unarchive(id: string): Promise<Conversation> {
    const res = await this.client.request<Envelope<Conversation>>('PATCH', `/chat/conversations/${id}/unarchive`);
    return res.data;
  }

  async exportConversation(id: string, format: 'json' | 'md' = 'json'): Promise<string> {
    const url = `/chat/conversations/${id}/export`;
    const res = await this.client.request<string>('GET', url, { params: { format } });
    return res as unknown as string;
  }

  /**
   * Send a message and get the raw SSE stream back.
   * Use the returned ReadableStream with a reader or the AI SDK.
   */
  async sendMessageStream(opts: SendMessageOptions): Promise<ReadableStream<Uint8Array>> {
    return this.client.stream('/chat/messages', opts);
  }

  async getEnabledModels(): Promise<EnabledLlmModelGroup[]> {
    const res = await this.client.request<Envelope<EnabledLlmModelGroup[]>>('GET', '/chat/enabled-models');
    return res.data;
  }
}
