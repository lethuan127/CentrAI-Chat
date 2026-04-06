import { toAISdkStream } from '@mastra/ai-sdk';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { Agent } from '@mastra/core/agent';
import type { MastraModelOutput } from '@mastra/core/stream';
import { Memory } from '@mastra/memory';
import type { PostgresStore } from '@mastra/pg';
import type { ModelMessage } from 'ai';
import { stepCountIs } from 'ai';

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
}

export interface CentrAiChatStreamResult {
  mastraOutput: MastraModelOutput;
  /** AI SDK v6 UI message stream parts for `writer.write` / piping. */
  sdkUiStream: ReadableStream<unknown>;
}

/**
 * Runs the CentrAI Mastra agent for a chat **turn**: model loop + AI SDK v6 UI stream.
 * Transcript persistence for users is the API’s job (Prisma). Mastra Memory here is only when callers pass `postgresStore` for non-UI runtime.
 */
export async function createCentrAiChatStream(
  params: CentrAiChatStreamParams,
): Promise<CentrAiChatStreamResult> {
  const {
    instructions,
    model,
    messages,
    agentId = DEFAULT_AGENT_ID,
    name = DEFAULT_NAME,
    maxSteps = DEFAULT_MAX_STEPS,
    postgresStore,
    memoryScope,
  } = params;

  const useMemory = postgresStore != null && memoryScope != null;
  const memory = useMemory
    ? new Memory({
        storage: postgresStore,
        vector: false,
        options: {
          generateTitle: false,
          lastMessages: 50,
          semanticRecall: false,
        },
      })
    : undefined;

  const mastraAgent = new Agent({
    id: agentId,
    name,
    instructions,
    model: model as ConstructorParameters<typeof Agent>[0]['model'],
    ...(memory ? { memory } : {}),
  });

  const mastraOutput = await mastraAgent.stream(messages as MessageListInput, {
    stopWhen: stepCountIs(maxSteps),
    ...(useMemory
      ? {
          memory: {
            thread: memoryScope.thread,
            resource: memoryScope.resource,
          },
        }
      : {}),
  });

  const sdkUiStream = toAISdkStream(mastraOutput, {
    from: 'agent',
    version: 'v6',
  }) as ReadableStream<unknown>;

  return { mastraOutput, sdkUiStream };
}
