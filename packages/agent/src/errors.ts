/** Thrown when a runtime adapter fails in a way callers should map to HTTP/errors. */
export class AgentRuntimeError extends Error {
  constructor(
    message: string,
    readonly options?: { readonly cause?: unknown; readonly adapterId?: string },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'AgentRuntimeError';
  }
}
