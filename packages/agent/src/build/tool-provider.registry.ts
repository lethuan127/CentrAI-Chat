import type { ToolProvider, ToolProviderRegistry } from './mastra-tool.factory.js';

/**
 * Builds a frozen registry from a plain record (one strategy per tool name).
 */
export function createToolProviderRegistry(
  providers: Record<string, ToolProvider>,
): ToolProviderRegistry {
  return new Map(Object.entries(providers));
}

/**
 * Returns a new registry with one additional provider (immutable update).
 */
export function registerToolProvider(
  registry: ToolProviderRegistry,
  name: string,
  provider: ToolProvider,
): ToolProviderRegistry {
  const next = new Map(registry);
  next.set(name, provider);
  return next;
}
