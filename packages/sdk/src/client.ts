export interface CentrAIConfig {
  baseUrl: string;
  accessToken?: string;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export class CentrAIClient {
  private baseUrl: string;
  private accessToken: string | undefined;

  constructor(config: CentrAIConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.accessToken = config.accessToken;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    if (this.accessToken) h['Authorization'] = `Bearer ${this.accessToken}`;
    return h;
  }

  private qs(params: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    }
    return parts.length ? `?${parts.join('&')}` : '';
  }

  async request<T>(method: string, path: string, opts?: { body?: unknown; params?: Record<string, unknown> }): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}${opts?.params ? this.qs(opts.params) : ''}`;
    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => res.text());
      throw new HttpError(res.status, body);
    }
    return res.json() as Promise<T>;
  }

  async stream(path: string, body: unknown): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => res.text());
      throw new HttpError(res.status, errBody);
    }
    if (!res.body) throw new Error('No response body for stream');
    return res.body;
  }
}
