import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import type { ChatMessage } from '../domain/message.js';
import { appendMessages, sliceMessageHistory, type SliceHistoryOptions } from '../domain/message.js';
import type { SessionState } from '../domain/session-state.js';

export interface MergeRunContextOptions {
  /** Per-request or per-user session state; shallow-merged over builder default. */
  sessionState?: SessionState | null;
  /** Extra messages appended after trimmed history. */
  messages?: readonly ChatMessage[];
  sliceHistory?: SliceHistoryOptions;
}

/**
 * Produces trimmed history plus optional request messages, honoring `maxTurnsMessageHistory`.
 */
export function mergeRunContext(
  def: RuntimeAgentDefinition,
  options: MergeRunContextOptions = {},
): { messages: ChatMessage[]; sessionState: SessionState | null } {
  const sliced =
    def.maxTurnsMessageHistory != null && def.maxTurnsMessageHistory > 0
      ? sliceMessageHistory(def.messageHistory, { maxTurns: def.maxTurnsMessageHistory })
      : [...def.messageHistory];

  const further =
    options.sliceHistory?.maxTurns != null
      ? sliceMessageHistory(sliced, { maxTurns: options.sliceHistory.maxTurns })
      : sliced;

  const messages =
    options.messages != null && options.messages.length > 0
      ? appendMessages(further, options.messages)
      : further;

  const sessionState =
    def.sessionState == null && options.sessionState == null
      ? null
      : { ...(def.sessionState ?? {}), ...(options.sessionState ?? {}) };

  return { messages, sessionState };
}
