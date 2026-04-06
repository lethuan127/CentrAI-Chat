import type { CentrAIClient } from '../client.js';
import type { RegisterDto, LoginDto, AuthResponse, TokenPair } from '@centrai/types';

interface Envelope<T> { data: T; error: null; meta?: Record<string, unknown> }

export class AuthResource {
  constructor(private client: CentrAIClient) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const res = await this.client.request<Envelope<AuthResponse>>('POST', '/auth/register', { body: dto });
    return res.data;
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const res = await this.client.request<Envelope<AuthResponse>>('POST', '/auth/login', { body: dto });
    return res.data;
  }

  async refresh(refreshToken: string): Promise<{ tokens: TokenPair }> {
    const res = await this.client.request<Envelope<{ tokens: TokenPair }>>('POST', '/auth/refresh', {
      body: { refreshToken },
    });
    return res.data;
  }

  async logout(refreshToken?: string): Promise<void> {
    await this.client.request('POST', '/auth/logout', { body: { refreshToken } });
  }

  async me(): Promise<AuthResponse['user']> {
    const res = await this.client.request<Envelope<AuthResponse['user']>>('GET', '/auth/me');
    return res.data;
  }
}
