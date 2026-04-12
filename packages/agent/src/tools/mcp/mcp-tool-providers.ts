import { MCPClient } from '@mastra/mcp';
import type { Tool as MastraTool } from '@mastra/core/tools';

import type { ToolProvider, ToolProviderRegistry } from '../../build/mastra-tool.factory.js';
import { createToolProviderRegistry } from '../../build/tool-provider.registry.js';
import type { McpConfigFile } from './mcp-server-config.js';
import { mcpConfigToServerDef } from './mcp-client-adapter.js';

/**
 * Connects to every MCP server listed in `mcpConfig`, enumerates their tools,
 * and returns a {@link ToolProviderRegistry} with one entry per tool.
 *
 * Registry keys follow the convention `mcp:<serverName>/<toolName>`.
 * Add the same key to an agent's `toolRefs` to attach just that tool:
 * ```json
 * [{ "name": "mcp:agentic-memory/store_memory" }]
 * ```
 *
 * Tool names are taken from `listToolsets()` — they are NOT namespaced with
 * the server prefix, so `store_memory` not `agentic-memory_store_memory`.
 *
 * The {@link MCPClient} instances stay connected after this call so the
 * returned tool `execute` functions can reach their server.
 *
 * Call once at application startup and pass the result into
 * `CreateMastraToolsContext.registry`.
 */
export async function createMcpToolProviders(
  mcpConfig: McpConfigFile,
): Promise<ToolProviderRegistry> {
  const providers: Record<string, ToolProvider> = {};

  for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
    const client = new MCPClient({
      servers: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [serverName]: mcpConfigToServerDef(serverConfig) as any,
      },
    });

    // listToolsets() returns tools per-server without the "serverName_" prefix.
    // The client stays alive so tool execute() calls can reach the server.
    const toolsets = await client.listToolsets();
    const serverTools = toolsets[serverName] ?? {};

    for (const [toolName, mastraTool] of Object.entries(serverTools)) {
      const tool = mastraTool as MastraTool;
      const refName = `mcp:${serverName}/${toolName}`;
      providers[refName] = () => tool;
    }
  }

  return createToolProviderRegistry(providers);
}
