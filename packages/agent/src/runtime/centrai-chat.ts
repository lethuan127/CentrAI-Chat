import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { MastraModelOutput } from '@mastra/core/stream';
import type { PostgresStore } from '@mastra/pg';
import type { ModelMessage } from 'ai';

import { COMPILED_RUN_PLAN_VERSION, type CompiledRunPlan } from '../compile/compiled-run-plan.js';
import { AgentRuntimeError } from '../errors.js';
import { createRuntimeAdapter } from './factory.js';
import type { AdapterDeps } from './types.js';

const DEFAULT_AGENT_ID = 'centrai-chat';
const DEFAULT_NAME = 'CentrAI Chat';
const DEFAULT_MAX_STEPS = 25;

/**
 * Mastra Memory thread/resource for **workflow or debug** runners only.
 * Not for mirroring end-user chat; trusted chat history for the UI lives in Prisma.
 */
export interface CentrAiChatMemoryScope {
  thread: string;
  resource: string;
}

export interface CentrAiChatStreamParams {
  /** System instructions (built from agent config or default assistant). */
  instructions: string;
  /**
   * AI SDK language model from the backend provider layer (v6 at runtime).
   * Mastra’s types target AI SDK v5; this package applies the same cast the API used previously.
   */
  model: unknown;
  /** Model messages (e.g. from `convertToModelMessages(uiMessages)` in the API). */
  messages: ModelMessage[] | MessageListInput;
  agentId?: string;
  name?: string;
  /** Passed to `stopWhen: stepCountIs(maxSteps)`. */
  maxSteps?: number;
  /**
   * Optional Mastra {@link PostgresStore} + memory scope for **workflows / debug tooling** (future or separate entrypoints).
   * Do not use this to duplicate user chat: conversation messages in the API DB are the source of truth for the chat UI.
   */
  postgresStore?: PostgresStore;
  memoryScope?: CentrAiChatMemoryScope;
  /** Abort when the client disconnects (e.g. `req.on('close')` + `AbortController`). */
  abortSignal?: AbortSignal;
}

export interface CentrAiChatStreamResult {
  mastraOutput: MastraModelOutput;
  /** AI SDK v6 UI message stream parts for `writer.write` / piping. */
  sdkUiStream: ReadableStream<unknown>;
}

function chatParamsToCompiledRunPlan(params: CentrAiChatStreamParams): CompiledRunPlan {
  const useMemory = params.postgresStore != null && params.memoryScope != null;
  return {
    planVersion: COMPILED_RUN_PLAN_VERSION,
    instructions: params.instructions,
    messages: params.messages,
    limits: { maxSteps: params.maxSteps ?? DEFAULT_MAX_STEPS },
    memory: useMemory
      ? {
          mode: 'mastra_pg',
          thread: params.memoryScope!.thread,
          resource: params.memoryScope!.resource,
        }
      : { mode: 'none' },
    agentId: params.agentId ?? DEFAULT_AGENT_ID,
    name: params.name ?? DEFAULT_NAME,
  };
}

function chatParamsToAdapterDeps(params: CentrAiChatStreamParams): AdapterDeps {
  return {
    model: params.model,
    ...(params.abortSignal != null ? { abortSignal: params.abortSignal } : {}),
    ...(params.postgresStore != null
      ? { mastra: { postgresStore: params.postgresStore } }
      : {}),
  };
}

/**
 * Runs the CentrAI Mastra agent for a chat **turn**: model loop + AI SDK v6 UI stream.
 * Implemented via `createRuntimeAdapter({ kind: 'mastra' })` so other runtimes can share the same surface later.
 * Transcript persistence for users is the API’s job (Prisma). Mastra Memory here is only when callers pass `postgresStore` for non-UI runtime.
 */
export async function createCentrAiChatStream(
  params: CentrAiChatStreamParams,
): Promise<CentrAiChatStreamResult> {
  const adapter = createRuntimeAdapter({ kind: 'mastra' });
  const plan = chatParamsToCompiledRunPlan(params);
  const deps = chatParamsToAdapterDeps(params);

  const supported = adapter.supports(plan);
  if (!supported.ok) {
    throw new AgentRuntimeError(supported.reason, { adapterId: adapter.id });
  }

  const out = await adapter.streamRun(plan, deps);
  return {
    mastraOutput: out.raw as MastraModelOutput,
    sdkUiStream: out.uiStream,
  };
}
