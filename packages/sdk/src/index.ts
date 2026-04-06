import { CentrAIClient } from './client.js';
import type { CentrAIConfig } from './client.js';
import { AuthResource } from './resources/auth.js';
import { ChatResource } from './resources/chat.js';
import { AgentsResource } from './resources/agents.js';
import { ProvidersResource } from './resources/providers.js';
import { AdminResource } from './resources/admin.js';

export class CentrAI {
  private client: CentrAIClient;

  readonly auth: AuthResource;
  readonly chat: ChatResource;
  readonly agents: AgentsResource;
  readonly providers: ProvidersResource;
  readonly admin: AdminResource;

  constructor(config: CentrAIConfig) {
    this.client = new CentrAIClient(config);
    this.auth = new AuthResource(this.client);
    this.chat = new ChatResource(this.client);
    this.agents = new AgentsResource(this.client);
    this.providers = new ProvidersResource(this.client);
    this.admin = new AdminResource(this.client);
  }

  setAccessToken(token: string) {
    this.client.setAccessToken(token);
  }
}

export { CentrAIClient, CentrAIConfig, HttpError } from './client.js';
export { AuthResource } from './resources/auth.js';
export { ChatResource, type SendMessageOptions } from './resources/chat.js';
export { AgentsResource } from './resources/agents.js';
export { ProvidersResource, type EnabledModelsGroup, type TestConnectionResult } from './resources/providers.js';
export { AdminResource } from './resources/admin.js';
export { consumeStream, type StreamCallbacks } from './streaming.js';
