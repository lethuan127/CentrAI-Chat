import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { ModelMessage } from 'ai';

/** Bump when `CompiledRunPlan` semantics change; adapters assert supported range. */
export const COMPILED_RUN_PLAN_VERSION = 1 as const;

export interface CompiledRunPlanLimits {
  maxSteps: number;
}

export type CompiledRunPlanMemory =
  | { mode: 'none' }
  | { mode: 'mastra_pg'; thread: string; resource: string };

/**
 * v1 run plan consumed by `AgentRuntimeAdapter`. Produced by the chat bridge today;
 * later, `compile-agent-turn` can build this from `RuntimeAgentDefinition` + request context.
 */
export interface CompiledRunPlan {
  planVersion: typeof COMPILED_RUN_PLAN_VERSION;
  instructions: string;
  messages: ModelMessage[] | MessageListInput;
  limits: CompiledRunPlanLimits;
  memory: CompiledRunPlanMemory;
  agentId?: string;
  name?: string;
}
