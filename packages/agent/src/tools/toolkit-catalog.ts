import type { CentrAITools } from './centrai-tools.js';
import { FirecrawlTools } from './firecrawl.js';
import type { McpConfigFile } from './mcp/mcp-server-config.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Full catalog entry (internal — includes the factory function).
 * Not safe to serialise; use {@link ToolkitInfo} for API responses.
 */
export interface ToolkitCatalogEntry {
  /** Registry key stored in `Agent.tools[].name` and used at runtime. */
  name: string;
  /** Human-readable label shown in the UI tool picker. */
  displayName: string;
  /** Short description rendered as a tooltip / card body in the UI. */
  description: string;
  /** UI grouping category (e.g. "Web", "Productivity"). */
  category: string;
  /**
   * Environment variable names required for this toolkit to function.
   * The UI uses this to show a config warning when the vars are absent.
   */
  requiredEnvVars?: string[];
  /**
   * Factory that creates a fully-configured {@link CentrAITools} instance.
   * All tools in the toolkit are enabled by default; individual callers may
   * override this by not using the catalog factory.
   */
  factory: () => CentrAITools;
}

/**
 * UI-safe subset of {@link ToolkitCatalogEntry} — the factory is stripped
 * so this can be serialised and sent over the wire.
 */
export type ToolkitInfo = Omit<ToolkitCatalogEntry, 'factory'>;

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * All built-in toolkits that agents can attach.
 * Each entry is registered under a stable `name` that is persisted in the
 * `Agent.tools` JSON column as `{ name: string }`.
 *
 * To add a new toolkit:
 * 1. Implement a class extending {@link CentrAITools} in `src/tools/`.
 * 2. Add an entry here with a unique `name`.
 * 3. The toolkit is automatically available in the UI and at runtime.
 */
export const TOOLKIT_CATALOG: ToolkitCatalogEntry[] = [
  {
    name: 'web-search',
    displayName: 'Web Search',
    description:
      'Scrape websites, crawl links, enumerate site URLs, and search the public web using the Firecrawl API. ' +
      'Ideal for agents that need to retrieve up-to-date information from the internet.',
    category: 'Web',
    requiredEnvVars: ['FIRECRAWL_API_KEY'],
    factory: () =>
      new FirecrawlTools({
        enableScrape: true,
        enableCrawl: true,
        enableMapping: true,
        enableSearch: true,
      }),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the public toolkit catalog (factory stripped) for serialisation.
 * Use this in API route handlers.
 */
export function getToolkitCatalog(): ToolkitInfo[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return TOOLKIT_CATALOG.map(({ factory: _factory, ...info }) => info);
}

/**
 * Connects to every MCP server in `mcpConfig`, fetches their tool manifests,
 * and registers each server as a `"mcp:<serverName>"` entry in
 * {@link TOOLKIT_CATALOG}.
 *
 * Call **once at application startup** (e.g. in `AppModule.onModuleInit`)
 * before any agent is constructed. After this call, agents can attach a whole
 * MCP server by adding `{ name: "mcp:<serverName>" }` to their `toolRefs`.
 *
 * The MCP clients are kept connected after registration so that tool
 * `execute` calls issued during chat turns can reach the server.
 *
 * @example
 * ```ts
 * // apps/api — NestJS module init
 * import mcpConfig from '../../../.mcp.json';
 * import { mcpConfigFileSchema, registerMcpToolkitsFromConfig } from '@centrai/agent';
 *
 * await registerMcpToolkitsFromConfig(mcpConfigFileSchema.parse(mcpConfig));
 * ```
 */
export async function registerMcpToolkitsFromConfig(
  mcpConfig: McpConfigFile,
): Promise<void> {
  const { McpCentrAITools } = await import('./mcp/mcp-centrai-tools.js');

  for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
    const toolkit = await McpCentrAITools.create(serverName, serverConfig);

    TOOLKIT_CATALOG.push({
      name: `mcp:${serverName}`,
      displayName: toTitleCase(serverName),
      description: `Tools provided by the "${serverName}" MCP server.`,
      category: 'MCP',
      factory: () => toolkit,
    });
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toTitleCase(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Splits a list of tool-ref names into two groups:
 * - `toolkits`: catalog entries matched by name → instantiated via factory
 * - `remaining`: names not found in the catalog → passed to the ToolProvider registry
 */
export function resolveToolkitsFromRefs(names: string[]): {
  toolkits: CentrAITools[];
  remaining: string[];
} {
  const catalogByName = new Map(TOOLKIT_CATALOG.map((e) => [e.name, e]));

  const toolkits: CentrAITools[] = [];
  const remaining: string[] = [];

  for (const name of names) {
    const entry = catalogByName.get(name);
    if (entry) {
      toolkits.push(entry.factory());
    } else {
      remaining.push(name);
    }
  }

  return { toolkits, remaining };
}
