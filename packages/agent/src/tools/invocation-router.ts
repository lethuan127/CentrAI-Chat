/**
 * Single tool invocation from the model. All runtimes should route execution through a shared
 * handler (timeouts, RBAC, audit) built from these shapes.
 */
export interface ToolInvocationCall {
  name: string;
  args: unknown;
}

export type ToolInvocationHandler = (call: ToolInvocationCall) => Promise<unknown>;
