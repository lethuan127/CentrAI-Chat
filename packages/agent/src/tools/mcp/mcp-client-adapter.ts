import Handlebars from 'handlebars';

import type { McpServerConfig } from './mcp-server-config.js';
import { buildTemplateData, type RequestContextLike } from '../../domain/request-context-vars.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * HTTP server definition accepted by `MCPClient` from `@mastra/mcp`.
 *
 * Using the `fetch` field (instead of `requestInit`) allows per-request
 * header injection via the Mastra `RequestContext` that is forwarded through
 * `Agent.stream` → tool `execute` → MCP server call.
 */
type McpHttpServerDef = {
  url: URL;
  fetch: (
    url: string | URL,
    init?: RequestInit,
    requestContext?: RequestContextLike | null,
  ) => Promise<Response>;
  timeout?: number;
};

type McpStdioServerDef = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
};

export type McpServerDef = McpHttpServerDef | McpStdioServerDef;

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * Maps a {@link McpServerConfig} (our Zod-typed shape) to the server
 * definition shape expected by `MCPClient` from `@mastra/mcp`.
 *
 * **HTTP transports** (`streamable-http`, `sse`) compile header value templates
 * with Handlebars once at startup, then render them per-request using the
 * Mastra `RequestContext` data. Supported template variables are defined in
 * {@link CENTRAI_CONTEXT_VAR}; any key present in the context or `process.env`
 * can also be used.
 *
 * Template example:
 * ```json
 * { "headers": { "Authorization": "Bearer {{USER_ACCESS_TOKEN}}" } }
 * ```
 *
 * Resolution order per variable: RequestContext → process.env → `""` (empty).
 *
 * **Stdio** is returned as-is — auth is handled via `env` vars at process
 * spawn time.
 */
export function mcpConfigToServerDef(config: McpServerConfig): McpServerDef {
  if (config.type === 'stdio') {
    return {
      command: config.command,
      ...(config.args !== undefined ? { args: config.args } : {}),
      ...(config.env !== undefined ? { env: config.env } : {}),
    };
  }

  const { timeout } = config;

  // Pre-compile each header value as a Handlebars template once at startup.
  // noEscape: true — header values are plain strings, not HTML.
  const compiledHeaders = Object.fromEntries(
    Object.entries(config.headers ?? {}).map(([name, value]) => [
      name,
      Handlebars.compile(value, { noEscape: true }),
    ]),
  );

  return {
    url: new URL(config.url),
    ...(timeout !== undefined ? { timeout } : {}),
    /**
     * Per-request fetch: renders compiled header templates using the Mastra
     * RequestContext forwarded through Agent.stream → tool execute.
     */
    fetch: async (url, init, requestContext) => {
      const headers = new Headers(init?.headers);
      const data = buildTemplateData(requestContext);

      for (const [name, render] of Object.entries(compiledHeaders)) {
        headers.set(name, render(data));
      }

      return globalThis.fetch(url, { ...init, headers });
    },
  };
}
