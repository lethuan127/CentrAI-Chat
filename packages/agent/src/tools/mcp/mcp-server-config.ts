import { z } from 'zod';

// ---------------------------------------------------------------------------
// Per-transport schemas
// ---------------------------------------------------------------------------

export const mcpStreamableHttpConfigSchema = z.object({
  type: z.literal('streamable-http'),
  /** MCP server endpoint URL. */
  url: z.string().url(),
  /**
   * HTTP headers forwarded on every request (e.g. Authorization).
   * Template vars like `{{VAR}}` must be resolved by the caller before passing
   * this config to {@link McpCentrAITools.create} or {@link createMcpToolProviders}.
   */
  headers: z.record(z.string()).optional(),
  /** Per-request timeout in milliseconds. Defaults to 60 000. */
  timeout: z.number().int().positive().optional(),
  /** Fetch and surface the server's own usage instructions. */
  serverInstructions: z.boolean().optional(),
  /** Connect automatically on startup (IDE hint — ignored at runtime). */
  startup: z.boolean().optional(),
});

export const mcpSseConfigSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
});

export const mcpStdioConfigSchema = z.object({
  type: z.literal('stdio'),
  /** Executable to launch (e.g. `"npx"`, `"python"`). */
  command: z.string().min(1),
  /** CLI arguments passed to the command. */
  args: z.array(z.string()).optional(),
  /** Extra environment variables merged into the child-process env. */
  env: z.record(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Union + file schema
// ---------------------------------------------------------------------------

/**
 * Discriminated union covering all three MCP transports.
 * Used to validate individual entries in `.mcp.json`.
 */
export const mcpServerConfigSchema = z.discriminatedUnion('type', [
  mcpStreamableHttpConfigSchema,
  mcpSseConfigSchema,
  mcpStdioConfigSchema,
]);

/**
 * Top-level `.mcp.json` file shape.
 * Keys in `mcpServers` are the stable server names used in {@link AgentToolRef}.
 */
export const mcpConfigFileSchema = z.object({
  mcpServers: z.record(mcpServerConfigSchema),
});

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

export type McpStreamableHttpConfig = z.infer<typeof mcpStreamableHttpConfigSchema>;
export type McpSseConfig = z.infer<typeof mcpSseConfigSchema>;
export type McpStdioConfig = z.infer<typeof mcpStdioConfigSchema>;
export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type McpConfigFile = z.infer<typeof mcpConfigFileSchema>;
