import { MCPClient } from '@mastra/mcp';
import type { Tool as MastraTool } from '@mastra/core/tools';

import { CentrAITools } from '../centrai-tools.js';
import type { McpServerConfig } from './mcp-server-config.js';
import { mcpConfigToServerDef } from './mcp-client-adapter.js';

/**
 * A {@link CentrAITools} implementation that bundles **all tools from a single
 * MCP server** into one toolkit catalog entry.
 *
 * Use {@link McpCentrAITools.create} — the async factory — to connect to the
 * server, fetch its tool manifest, and return a ready-to-use instance.
 * The underlying {@link MCPClient} stays connected for the lifetime of the
 * toolkit so that tool `execute` calls can reach the server.
 *
 * @example
 * ```ts
 * const toolkit = await McpCentrAITools.create('agentic-memory', {
 *   type: 'streamable-http',
 *   url: 'http://localhost:8015/memory/mcp',
 *   headers: { Authorization: 'Bearer <token>' },
 * });
 * // toolkit is a CentrAITools — pass it to createMastraAgent({ toolkits })
 * // or register it via registerMcpToolkitsFromConfig.
 * ```
 */
export class McpCentrAITools extends CentrAITools {
  /**
   * The server's own usage instructions from the MCP `InitializeResult`.
   * Empty string when the server does not advertise instructions — in that
   * case {@link buildSystemPrompt} skips the block entirely.
   */
  readonly instructions: string;

  private readonly _tools: MastraTool[];
  private readonly _client: MCPClient;

  private constructor(
    instructions: string,
    tools: MastraTool[],
    client: MCPClient,
  ) {
    super();
    this.instructions = instructions;
    this._tools = tools;
    this._client = client;
  }

  toMastraTools(): MastraTool[] {
    return this._tools;
  }

  /**
   * Disconnects from the MCP server. Call during application shutdown if you
   * need clean teardown. Not required for normal agent operation.
   */
  async disconnect(): Promise<void> {
    await this._client.disconnect();
  }

  /**
   * Async factory: connects to the MCP server described by `config`, fetches
   * its tool manifest, and reads the server-provided `instructions` from the
   * MCP `InitializeResult` handshake.
   *
   * `instructions` is sourced exclusively from the server — never generated
   * from the tool list. If the server omits `instructions`, the field is an
   * empty string and {@link buildSystemPrompt} will not inject any block.
   *
   * The client is kept connected after this call because the returned Mastra
   * tools hold an internal reference to it for `execute` calls.
   */
  static async create(
    serverName: string,
    config: McpServerConfig,
  ): Promise<McpCentrAITools> {
    const client = new MCPClient({
      servers: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [serverName]: mcpConfigToServerDef(config) as any,
      },
    });

    // listToolsets() returns tools grouped by server name without the
    // "serverName_" namespace prefix that listTools() adds.
    const toolsets = await client.listToolsets();
    const tools = Object.values(toolsets[serverName] ?? {}) as MastraTool[];

    // Read server instructions from the MCP InitializeResult.
    // MCPClient stores InternalMastraMCPClient instances in mcpClientsById;
    // each wraps a raw @modelcontextprotocol/sdk Client that exposes
    // getInstructions() after the initialize handshake completes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalClient = (client as any).mcpClientsById?.get(serverName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serverInstructions: string = (internalClient as any)?.client?.getInstructions?.() ?? '';

    return new McpCentrAITools(serverInstructions, tools, client);
  }
}
