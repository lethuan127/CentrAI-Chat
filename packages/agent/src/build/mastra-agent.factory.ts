import Handlebars from 'handlebars';

import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { Tool as MastraTool } from '@mastra/core/tools';

import type { CentrAITools } from '../tools/centrai-tools.js';
import { resolveToolkitsFromRefs } from '../tools/toolkit-catalog.js';
import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { buildTemplateData, type RequestContextLike } from '../domain/request-context-vars.js';
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
  /**
   * {@link CentrAITools} instances whose `instructions` and `toMastraTools()`
   * output are merged into the agent. Tools from toolkits are merged with any
   * tools already in `toolContext` / `tools`.
   */
  toolkits?: CentrAITools[];
  memory?: ConstructorParameters<typeof Agent>[0]['memory'];
  agentId?: string;
  name?: string;
}

/** Alias for {@link CreateMastraAgentParams} (architecture doc naming). */
export type MastraAgentFactoryDeps = CreateMastraAgentParams;

/**
 * Builds a Mastra {@link Agent} from a {@link RuntimeAgentDefinition} and injected model/tools/memory.
 *
 * Tool refs in `definition.toolRefs` are resolved in two passes:
 * 1. Names matching the {@link TOOLKIT_CATALOG} are auto-instantiated as
 *    {@link CentrAITools} and merged with any explicitly provided `toolkits`.
 * 2. Remaining names are resolved via the {@link ToolProviderRegistry} in
 *    `toolContext` (individual single-function tools).
 *
 * The agent's `instructions` are compiled as a **Handlebars template** at
 * construction time and rendered per-request using the Mastra `RequestContext`.
 * Admin-authored instructions can reference any {@link CENTRAI_CONTEXT_VAR}
 * key — e.g. `"You are helping {{USER_NAME}} ({{USER_EMAIL}})."`.
 */
export async function createMastraAgent(
  params: CreateMastraAgentParams,
): Promise<Agent> {
  // ── Step 1: auto-resolve catalog toolkits from definition.toolRefs ────────
  const { toolkits: catalogToolkits, remaining: remainingRefNames } = resolveToolkitsFromRefs(
    params.definition.toolRefs.map((r) => r.name),
  );

  // Merge explicitly provided toolkits (caller wins on duplicates by position).
  const allToolkits: CentrAITools[] = [...catalogToolkits, ...(params.toolkits ?? [])];

  // ── Step 2: resolve remaining refs via the ToolProvider registry ──────────
  let tools: ToolsInput | undefined = params.tools;

  const remainingRefs = params.definition.toolRefs.filter((r) =>
    remainingRefNames.includes(r.name),
  );

  const needsBuiltTools =
    remainingRefs.length > 0 && (tools == null || Object.keys(tools).length === 0);

  if (needsBuiltTools) {
    if (!params.toolContext) {
      throw new Error(
        'createMastraAgent: `toolContext` is required when the definition lists toolRefs that are not in the toolkit catalog and explicit `tools` are not provided',
      );
    }
    tools = await createMastraTools(remainingRefs, params.toolContext);
  }

  // ── Step 3: merge toolkit tools ───────────────────────────────────────────
  if (allToolkits.length > 0) {
    const toolkitTools: ToolsInput = {};
    for (const toolkit of allToolkits) {
      for (const tool of toolkit.toMastraTools()) {
        toolkitTools[tool.id] = tool;
      }
    }
    // Registry tools take precedence over toolkit tools on name collision.
    tools = { ...toolkitTools, ...(tools ?? {}) };
  }

  // ── Step 4: compile base prompt as Handlebars template (once at construction) ──
  const baseInstructions = buildSystemPrompt(
    params.definition,
    tools as Record<string, MastraTool> | undefined,
    allToolkits,
  );

  // noEscape: true — instructions are plain text, not HTML.
  const renderInstructions = Handlebars.compile(baseInstructions, { noEscape: true });

  const id = params.agentId ?? params.definition.name ?? 'centrai-agent';
  const name = params.name ?? params.definition.name ?? 'Agent';

  return new Agent({
    id,
    name,
    // Render the Handlebars instruction template with per-request context data.
    // {{USER_NAME}}, {{CONVERSATION_ID}}, etc. are replaced at stream time.
    // Instructions with no template variables render as-is (backward-compatible).
    instructions: ({ requestContext }) =>
      renderInstructions(buildTemplateData(requestContext as RequestContextLike | null)),
    model: params.model as ConstructorParameters<typeof Agent>[0]['model'],
    ...(tools != null && Object.keys(tools).length > 0 ? { tools } : {}),
    ...(params.memory != null ? { memory: params.memory } : {}),
  });
}
