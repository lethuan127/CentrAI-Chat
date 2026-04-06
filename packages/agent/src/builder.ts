import type { ChatMessage } from './messages.js';
import { appendMessages, sliceMessageHistory, type SliceHistoryOptions } from './messages.js';
import { buildSystemPrompt, type SystemPromptInput } from './prompt.js';
import type { SessionState } from './session.js';
import type { RuntimeTool } from './tools.js';
import { parseRuntimeTools } from './tools.js';

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

export interface MergeRunContextOptions {
  /** Per-request or per-user session state; shallow-merged over builder default. */
  sessionState?: SessionState | null;
  /** Extra messages appended after trimmed history. */
  messages?: readonly ChatMessage[];
  sliceHistory?: SliceHistoryOptions;
}

const emptyMeta: Record<string, unknown> = {};

export class AgentBuilder {
  private name?: string;
  private description?: string | null;
  private role = '';
  private instructions = '';
  private expectedOutput?: string | null;
  private tools: RuntimeTool[] = [];
  private sessionState: SessionState | null = null;
  private addSessionStateToContext = false;
  private messageHistory: ChatMessage[] = [];
  private maxTurnsMessageHistory: number | null = null;
  private metadata: Record<string, unknown> = emptyMeta;

  withIdentity(input: { name?: string; description?: string | null }): this {
    this.name = input.name;
    this.description = input.description ?? null;
    return this;
  }

  withRole(role: string): this {
    this.role = role;
    return this;
  }

  withInstructions(instructions: string): this {
    this.instructions = instructions;
    return this;
  }

  withExpectedOutput(expectedOutput: string | null | undefined): this {
    this.expectedOutput = expectedOutput ?? null;
    return this;
  }

  withTool(tool: RuntimeTool): this {
    this.tools.push(tool);
    return this;
  }

  withTools(tools: readonly RuntimeTool[]): this {
    this.tools.push(...tools);
    return this;
  }

  /**
   * Replace tools from a JSON value (e.g. Prisma `Agent.tools` column).
   */
  withToolsFromJson(value: unknown): this {
    this.tools = parseRuntimeTools(value);
    return this;
  }

  withSessionState(state: SessionState | null, options?: { injectIntoContext?: boolean }): this {
    this.sessionState = state;
    if (options?.injectIntoContext != null) {
      this.addSessionStateToContext = options.injectIntoContext;
    }
    return this;
  }

  withAddSessionStateToContext(enabled: boolean): this {
    this.addSessionStateToContext = enabled;
    return this;
  }

  withMessageHistory(messages: readonly ChatMessage[]): this {
    this.messageHistory = [...messages];
    return this;
  }

  withMaxTurnsMessageHistory(max: number | null): this {
    this.maxTurnsMessageHistory = max;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.metadata = { ...metadata };
    return this;
  }

  mergeMetadata(partial: Record<string, unknown>): this {
    this.metadata = { ...this.metadata, ...partial };
    return this;
  }

  build(): RuntimeAgentDefinition {
    return {
      name: this.name,
      description: this.description ?? null,
      role: this.role,
      instructions: this.instructions,
      expectedOutput: this.expectedOutput ?? null,
      tools: [...this.tools],
      sessionState: this.sessionState,
      addSessionStateToContext: this.addSessionStateToContext,
      messageHistory: [...this.messageHistory],
      maxTurnsMessageHistory: this.maxTurnsMessageHistory,
      metadata: { ...this.metadata },
    };
  }
}

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

export function agentBuilderFromPersisted(input: {
  name: string;
  description?: string | null;
  role: string;
  instructions: string;
  expectedOutput?: string | null;
  tools?: unknown;
  addSessionStateToContext?: boolean;
  maxTurnsMessageHistory?: number | null;
}): AgentBuilder {
  return new AgentBuilder()
    .withIdentity({ name: input.name, description: input.description })
    .withRole(input.role)
    .withInstructions(input.instructions)
    .withExpectedOutput(input.expectedOutput)
    .withToolsFromJson(input.tools ?? [])
    .withAddSessionStateToContext(input.addSessionStateToContext ?? false)
    .withMaxTurnsMessageHistory(input.maxTurnsMessageHistory ?? null);
}
