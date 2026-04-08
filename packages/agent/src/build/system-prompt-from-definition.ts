import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { buildSystemPrompt } from '../domain/prompt.js';
import type { SessionState } from '../domain/session-state.js';

export function systemPromptFromDefinition(
  def: RuntimeAgentDefinition,
  sessionOverride?: SessionState | null,
): string {
  const mergedState =
    def.sessionState == null && sessionOverride == null
      ? null
      : { ...(def.sessionState ?? {}), ...(sessionOverride ?? {}) };

  return buildSystemPrompt({
    ...def,
    sessionState: mergedState,
  });
}
