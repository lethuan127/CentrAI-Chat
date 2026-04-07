import type { ChatMessage } from './message.js';
import type { SessionState } from './session-state.js';
import type { RuntimeTool } from './tool-spec.js';

export interface RuntimeAgentDefinition {
  name?: string;
  description?: string | null;
  role: string;
  instructions: string;
  expectedOutput?: string | null;
  tools: RuntimeTool[];
  /** Default session snapshot; request-scoped state can override in `mergeRunContext`. */
  sessionState: SessionState | null;
  addSessionStateToContext: boolean;
  messageHistory: ChatMessage[];
  maxTurnsMessageHistory: number | null;
  metadata: Record<string, unknown>;
}
