import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { buildSystemPrompt, type SystemPromptInput } from '../domain/prompt.js';
import type { SessionState } from '../domain/session-state.js';

export function definitionToSystemPromptInput(
  def: RuntimeAgentDefinition,
  sessionOverride?: SessionState | null,
): SystemPromptInput {
  const mergedState =
    def.sessionState == null && sessionOverride == null
      ? null
      : { ...(def.sessionState ?? {}), ...(sessionOverride ?? {}) };

  return {
    name: def.name,
    description: def.description,
    role: def.role,
    instructions: def.instructions,
    expectedOutput: def.expectedOutput,
    sessionState: mergedState,
    includeSessionState: def.addSessionStateToContext,
  };
}

export function systemPromptFromDefinition(
  def: RuntimeAgentDefinition,
  sessionOverride?: SessionState | null,
): string {
  return buildSystemPrompt(definitionToSystemPromptInput(def, sessionOverride));
}
