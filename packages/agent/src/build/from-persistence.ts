import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { parseRuntimeTools } from '../domain/tool-spec.js';

/** Maps a persisted agent row shape (e.g. Prisma) to a {@link RuntimeAgentDefinition}. */
export function runtimeAgentDefinitionFromPersisted(input: {
  name: string;
  description?: string | null;
  role: string;
  instructions: string;
  expectedOutput?: string | null;
  tools?: unknown;
  addSessionStateToContext?: boolean;
  maxTurnsMessageHistory?: number | null;
}): RuntimeAgentDefinition {
  return {
    name: input.name,
    description: input.description ?? null,
    role: input.role,
    instructions: input.instructions,
    expectedOutput: input.expectedOutput ?? null,
    tools: parseRuntimeTools(input.tools ?? []),
    sessionState: null,
    addSessionStateToContext: input.addSessionStateToContext ?? false,
    messageHistory: [],
    maxTurnsMessageHistory: input.maxTurnsMessageHistory ?? null,
    metadata: {},
  };
}
