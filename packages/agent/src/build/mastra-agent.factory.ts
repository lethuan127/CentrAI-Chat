import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';

import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { buildSystemPrompt } from '../prompts/system-prompt.js';
import { createMastraTools, type CreateMastraToolsContext } from './mastra-tool.factory.js';

export interface CreateMastraAgentParams {
  definition: RuntimeAgentDefinition;
  /**
   * Mastra `Agent` constructor `model` — can be an AI SDK `LanguageModel`, Mastra model config,
   * or provider string. Typed as `unknown` here because the concrete type varies by Mastra version;
   * passed directly to `new Agent({ model })`.
   */
  model: unknown;
  /** Pre-built Mastra tools; if omitted, built from `definition.toolRefs` + `toolContext`. */
  tools?: ToolsInput;
  toolContext?: CreateMastraToolsContext;
  memory?: ConstructorParameters<typeof Agent>[0]['memory'];
  agentId?: string;
  name?: string;
  /**
   * When set, overrides assembled instructions (e.g. chat route with session preamble in the API).
   */
  instructionsOverride?: string;
}

/** Alias for {@link CreateMastraAgentParams} (architecture doc naming). */
export type MastraAgentFactoryDeps = CreateMastraAgentParams;

/**
 * Builds a Mastra {@link Agent} from a {@link RuntimeAgentDefinition} and injected model/tools/memory.
 */
export async function createMastraAgent(
  params: CreateMastraAgentParams,
): Promise<Agent> {
  let tools: ToolsInput | undefined = params.tools;

  const needsBuiltTools =
    params.definition.toolRefs.length > 0 &&
    (tools == null || Object.keys(tools).length === 0);

  if (needsBuiltTools) {
    if (!params.toolContext) {
      throw new Error(
        'createMastraAgent: `toolContext` is required when the definition lists toolRefs and explicit `tools` are not provided',
      );
    }
    tools = await createMastraTools(params.definition.toolRefs, params.toolContext);
  }

  const instructions = params.instructionsOverride ?? buildSystemPrompt(params.definition);

  const id = params.agentId ?? params.definition.name ?? 'centrai-agent';
  const name = params.name ?? params.definition.name ?? 'Agent';

  return new Agent({
    id,
    name,
    instructions,
    model: params.model as ConstructorParameters<typeof Agent>[0]['model'],
    ...(tools != null && Object.keys(tools).length > 0 ? { tools } : {}),
    ...(params.memory != null ? { memory: params.memory } : {}),
  });
}
