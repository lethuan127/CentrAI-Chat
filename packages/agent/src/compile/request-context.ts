/**
 * Request-scoped input for a future `compileAgentTurn(definition, context, ...)`.
 * The API constructs this; compile stays free of NestJS/HTTP types.
 */
export interface RequestContext {
  userId: string;
  workspaceId: string;
  conversationId?: string;
  /** When set, factory may select a matching `AgentRuntimeAdapter`. */
  agentRuntimeId?: 'mastra';
}
