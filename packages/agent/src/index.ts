/**
 * Public surface aligned with `docs/architecture.md` §7.
 */
export type { RuntimeAgentDefinition } from './domain/agent-definition.js';
export { runtimeAgentDefinitionFromPersisted, type PersistedAgentLike } from './build/from-persistence.js';
export {
  buildSystemPrompt,
  mergeSessionIntoSystemPrompt,
} from './prompts/system-prompt.js';
export { mergeSessionIntoSystemPrompt as mergeRunContext } from './prompts/system-prompt.js';
export {
  createCentrAiChatStream,
  type CentrAiChatMemoryScope,
  type CentrAiChatStreamParams,
  type CentrAiChatStreamResult,
  type StreamRunResult,
} from './runtime/stream-run.js';
export {
  createMastraAgent,
  type CreateMastraAgentParams,
  type MastraAgentFactoryDeps,
} from './build/mastra-agent.factory.js';
export {
  createMastraTools,
  type CreateMastraToolsContext,
  type ToolProvider,
  type ToolProviderRegistry,
} from './build/mastra-tool.factory.js';
export { createToolProviderRegistry, registerToolProvider } from './build/tool-provider.registry.js';
export { AgentRuntimeError, ToolProviderNotFoundError } from './runtime/errors.js';
export { FirecrawlTools } from './tools/index.js';
export type { FirecrawlToolsConfig } from './tools/index.js';
export { CentrAITools } from './tools/index.js';
export { getToolkitCatalog, TOOLKIT_CATALOG } from './tools/index.js';
export type { ToolkitCatalogEntry, ToolkitInfo } from './tools/index.js';
