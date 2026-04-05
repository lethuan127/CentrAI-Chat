import type { ApiResponse, ApiError } from '@centrai/types';
import { env } from './env';

const AUTH_COOKIE_NAME = 'centrai-auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function setAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function clearAuthCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0`;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = `${baseUrl}/api/v1`;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    setAuthCookie();
  }

  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    clearAuthCookie();
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return false;

      const json = await res.json();
      const tokens = json.data?.tokens;
      if (tokens) {
        this.setTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async fetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (res.status === 401 && token) {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
        res = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers,
        });
      } else {
        this.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expired');
      }
    }

    const json = await res.json();

    if (!res.ok) {
      const apiError = json as ApiError;
      throw new Error(apiError.error?.message || 'Request failed');
    }

    return json as ApiResponse<T>;
  }

  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, { method: 'GET' });
  }

  async patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.fetch<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(env.apiUrl);
