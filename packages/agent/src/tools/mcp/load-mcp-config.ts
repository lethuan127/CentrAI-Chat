import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { mcpConfigFileSchema } from './mcp-server-config.js';
import type { McpConfigFile } from './mcp-server-config.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Default candidate paths probed when `CENTRAI_MCP_PATH` is not set.
 * Listed in priority order — first readable file wins.
 *
 * - `<cwd>/.centrai/.mcp.json`    — running from the repo root
 * - `<cwd>/../../.centrai/.mcp.json` — running from `apps/api/` inside the monorepo
 */
const DEFAULT_CANDIDATES = ['.centrai/.mcp.json', '../../.centrai/.mcp.json'] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LoadMcpConfigOptions {
  /**
   * Explicit file path (absolute or relative to `cwd`).
   * Takes precedence over `CENTRAI_MCP_PATH` and the default candidates.
   */
  path?: string;
  /**
   * Base directory used to resolve relative paths.
   * Defaults to `process.cwd()`.
   */
  cwd?: string;
}

/**
 * Reads and validates the CentrAI MCP configuration file, returning a
 * parsed {@link McpConfigFile} or `null` if no file is found.
 *
 * **Path resolution order:**
 * 1. `options.path` — explicit override
 * 2. `CENTRAI_MCP_PATH` env var — deployment override
 * 3. `<cwd>/.centrai/.mcp.json` — repo-root default
 * 4. `<cwd>/../../.centrai/.mcp.json` — monorepo `apps/api/` default
 *
 * Returns `null` silently when no file exists at any candidate path.
 * Throws a `ZodError` if the file exists but fails schema validation.
 * Throws a `SyntaxError` if the file exists but contains invalid JSON.
 *
 * @example
 * ```ts
 * const mcpConfig = await loadMcpConfig();
 * if (mcpConfig) {
 *   await registerMcpToolkitsFromConfig(mcpConfig);
 * }
 * ```
 *
 * @example Custom path (e.g. tests)
 * ```ts
 * const mcpConfig = await loadMcpConfig({ path: '/tmp/test-mcp.json' });
 * ```
 */
export async function loadMcpConfig(
  options?: LoadMcpConfigOptions,
): Promise<McpConfigFile | null> {
  const cwd = options?.cwd ?? process.cwd();

  const candidates: string[] = options?.path
    ? [options.path]
    : process.env.CENTRAI_MCP_PATH
      ? [process.env.CENTRAI_MCP_PATH]
      : [...DEFAULT_CANDIDATES];

  for (const candidate of candidates) {
    const resolved = resolve(cwd, candidate);

    let raw: string;
    try {
      raw = await readFile(resolved, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw err;
    }

    return mcpConfigFileSchema.parse(JSON.parse(raw));
  }

  return null;
}
