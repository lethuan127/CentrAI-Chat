/** Thrown when a tool name has no registered provider. */
export class ToolProviderNotFoundError extends Error {
  readonly name = 'ToolProviderNotFoundError';

  constructor(readonly toolName: string) {
    super(`No tool provider registered for "${toolName}"`);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Thrown when the Mastra runtime fails in a way callers should map to HTTP/errors. */
export class AgentRuntimeError extends Error {
  constructor(
    message: string,
    readonly options?: { readonly cause?: unknown; readonly adapterId?: string },
  ) {
    super(message, options?.cause != null ? { cause: options.cause } : undefined);
    this.name = 'AgentRuntimeError';
  }
}
