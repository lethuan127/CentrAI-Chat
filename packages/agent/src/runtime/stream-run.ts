import { toAISdkStream } from '@mastra/ai-sdk';
import type { Agent } from '@mastra/core/agent';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import type { MastraModelOutput } from '@mastra/core/stream';
import { stepCountIs, type ModelMessage } from 'ai';

const UI_STREAM_VERSION = 'v6' as const;
const DEFAULT_MAX_STEPS = 25;

/**
 * Optional Mastra memory thread/resource scope.
 * For workflows or debug tooling only — end-user chat history lives in Prisma.
 */
export interface CentrAiChatMemoryScope {
  thread: string;
  resource: string;
}

export interface CentrAiChatStreamParams {
  /** Pre-built Mastra agent (from `createMastraAgent`). */
  agent: Agent;
  /** Model messages (e.g. from `convertToModelMessages(uiMessages)`). */
  messages: ModelMessage[] | MessageListInput;
  /** Max agentic steps before stopping. Defaults to 25. */
  maxSteps?: number;
  abortSignal?: AbortSignal;
  /** Optional Mastra memory scope (thread + resource). Not used for default Prisma-backed chat. */
  memoryScope?: CentrAiChatMemoryScope;
}

export interface CentrAiChatStreamResult {
  mastraOutput: MastraModelOutput;
  sdkUiStream: ReadableStream<unknown>;
}

/** @see architecture.md §7 */
export type StreamRunResult = CentrAiChatStreamResult;

/**
 * Facade: one chat turn — `Agent.stream` → `toAISdkStream` (AI SDK v6 UI chunks).
 *
 * Caller is responsible for building the agent via `createMastraAgent` before calling this.
 * @see architecture.md §3, §7
 */
export async function createCentrAiChatStream(
  params: CentrAiChatStreamParams,
): Promise<CentrAiChatStreamResult> {
  const { agent, messages, maxSteps = DEFAULT_MAX_STEPS, abortSignal, memoryScope } = params;

  const memoryOpts = memoryScope
    ? { memory: { thread: memoryScope.thread, resource: memoryScope.resource } }
    : {};

  const mastraOutput = await agent.stream(messages as MessageListInput, {
    stopWhen: stepCountIs(maxSteps),
    ...(abortSignal != null ? { abortSignal } : {}),
    ...memoryOpts,
  });

  const sdkUiStream = toAISdkStream(mastraOutput, {
    from: 'agent',
    version: UI_STREAM_VERSION,
  }) as ReadableStream<unknown>;

  return { mastraOutput, sdkUiStream };
}
