import { runtimeAgentDefinitionSchema, type RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { parseAgentToolRefsFromJson } from '../domain/agent-tool-ref.js';

export type PersistedAgentLike = {
  name: string;
  description: string | null;
  role: string;
  instructions: string;
  expectedOutput: string | null;
  tools: unknown;
  addSessionStateToContext: boolean;
  maxTurnsMessageHistory: number | null;
  modelId?: string | null;
  modelProvider?: string | null;
};

/**
 * Maps a DB agent row (or test fixture) into a Zod-validated `RuntimeAgentDefinition`.
 */
export function runtimeAgentDefinitionFromPersisted(row: PersistedAgentLike): RuntimeAgentDefinition {
  const candidate = {
    name: row.name,
    description: row.description,
    role: row.role,
    instructions: row.instructions,
    expectedOutput: row.expectedOutput,
    toolRefs: parseAgentToolRefsFromJson(row.tools),
    addSessionStateToContext: row.addSessionStateToContext,
    maxTurnsMessageHistory: row.maxTurnsMessageHistory,
    modelId: row.modelId ?? null,
    modelProvider: row.modelProvider ?? null,
    sessionState: null,
  };

  return runtimeAgentDefinitionSchema.parse(candidate);
}
