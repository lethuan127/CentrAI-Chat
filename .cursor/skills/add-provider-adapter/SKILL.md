---
name: add-provider-adapter
description: >-
  Add a new LLM provider adapter to the provider module following the
  OpenAI-compatible adapter pattern. Use when adding support for a new AI model
  provider, integrating a new LLM API, or when the user says "add provider",
  "new adapter", "integrate model", or mentions a specific provider name like
  "DeepSeek", "Mistral", "Cohere".
---

# Add Provider Adapter

Add a new LLM provider to `apps/api/src/provider/` following the OpenAI-compatible adapter pattern.

## Provider Adapter Interface

All adapters implement this interface:

```typescript
export interface ProviderAdapter {
  readonly type: string;

  complete(
    messages: ChatMessage[],
    options: CompletionOptions,
  ): Observable<CompletionChunk>;

  listModels(): Promise<ModelInfo[]>;
  countTokens(messages: ChatMessage[]): Promise<number>;
  healthCheck(): Promise<ProviderStatus>;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface CompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stream: boolean;
}

interface CompletionChunk {
  id: string;
  content: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | null;
  usage?: { promptTokens: number; completionTokens: number };
}
```

## Steps

### 1. Create Adapter File

Create `apps/api/src/provider/adapters/{name}.adapter.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { ProviderAdapter, ChatMessage, CompletionOptions, CompletionChunk } from '../interfaces';

@Injectable()
export class NewProviderAdapter implements ProviderAdapter {
  readonly type = 'new-provider';
  private readonly logger = new Logger(NewProviderAdapter.name);

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  complete(messages: ChatMessage[], options: CompletionOptions): Observable<CompletionChunk> {
    return new Observable((subscriber) => {
      this.streamCompletion(messages, options, subscriber).catch((err) => {
        this.logger.error('Completion failed', err);
        subscriber.error(err);
      });
    });
  }

  private async streamCompletion(messages, options, subscriber) {
    // 1. Map ChatMessage[] to provider-specific format
    // 2. POST to provider's streaming endpoint
    // 3. Parse SSE/streaming response
    // 4. Emit CompletionChunk for each token via subscriber.next()
    // 5. Call subscriber.complete() when done
  }

  async listModels(): Promise<ModelInfo[]> {
    // Fetch available models from provider API
  }

  async countTokens(messages: ChatMessage[]): Promise<number> {
    // Estimate token count (tiktoken for OpenAI-compat, or provider-specific)
  }

  async healthCheck(): Promise<ProviderStatus> {
    // Simple GET to validate API key and connectivity
  }
}
```

### 2. Key Implementation Details

**Request mapping** — translate our `ChatMessage[]` to the provider's format:
- OpenAI-compatible providers: pass through as-is
- Non-OpenAI providers: map `role`, `content`, `tool_calls` to provider format

**Streaming** — parse the provider's stream format:
- SSE (`text/event-stream`): parse `data: {...}` lines
- NDJSON: parse line-by-line JSON
- WebSocket: listen for message events

**Error mapping** — normalize provider errors:
```typescript
// Map provider-specific errors to our standard errors
if (response.status === 429) throw new TooManyRequestsException('Rate limited');
if (response.status === 401) throw new UnauthorizedException('Invalid API key');
```

### 3. Register Adapter

Add to the provider module's adapter factory/registry so it can be resolved by `provider.type` from the database.

### 4. Add Provider Type

Add the new type to the Prisma `ProviderType` enum and the Zod schema in `@centrai/types`.

### 5. Test

- Health check passes with valid API key
- `listModels()` returns at least one model
- Streaming completion emits tokens and completes
- Invalid API key returns clear error
