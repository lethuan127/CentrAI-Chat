import type { Tool as MastraTool } from '@mastra/core/tools';
import type { AgentToolRef } from '../domain/agent-tool-ref.js';

export type ToolProviderRegistry = ReadonlyMap<string, ToolProvider>;

export type CreateMastraToolsContext = {
  workspaceId: string;
  registry: ToolProviderRegistry;
};

export type ToolProvider = (
  ref: AgentToolRef,
  ctx: CreateMastraToolsContext,
) => Promise<MastraTool> | MastraTool;

/**
 * Resolves name-only tool refs into Mastra `Tool` instances via the registry.
 * Unknown names are skipped so agents can list tools before providers are wired.
 */
export async function createMastraTools(
  refs: AgentToolRef[],
  ctx: CreateMastraToolsContext,
): Promise<Record<string, MastraTool>> {
  const tools: Record<string, MastraTool> = {};
  const seen = new Set<string>();

  for (const ref of refs) {
    if (seen.has(ref.name)) {
      continue;
    }
    seen.add(ref.name);

    const provider = ctx.registry.get(ref.name);
    if (provider == null) {
      continue;
    }

    const tool = await provider(ref, ctx);
    tools[ref.name] = tool;
  }

  return tools;
}
