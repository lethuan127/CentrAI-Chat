import { toAISdkStream } from '@mastra/ai-sdk';
import type { MessageListInput } from '@mastra/core/agent/message-list';
import { Agent } from '@mastra/core/agent';
import type { MastraModelOutput } from '@mastra/core/stream';
import { Memory } from '@mastra/memory';
import { stepCountIs } from 'ai';

import { COMPILED_RUN_PLAN_VERSION, type CompiledRunPlan } from '../../compile/compiled-run-plan.js';
import { CENTRAI_UI_STREAM_VERSION } from '../shared/chunk-types.js';
import type { AdapterDeps, StreamRunResult } from '../types.js';

const DEFAULT_AGENT_ID = 'centrai-chat';
const DEFAULT_NAME = 'CentrAI Chat';

/**
 * Mastra-backed execution: one chat turn, AI SDK v6 UI stream.
 */
export async function executeMastraStreamRun(
  plan: CompiledRunPlan,
  deps: AdapterDeps,
): Promise<StreamRunResult> {
  if (plan.planVersion !== COMPILED_RUN_PLAN_VERSION) {
    throw new Error(`Unsupported CompiledRunPlan version: ${plan.planVersion}`);
  }

  const useMemory = plan.memory.mode === 'mastra_pg';
  if (useMemory && deps.mastra?.postgresStore == null) {
    throw new Error('memory.mode mastra_pg requires deps.mastra.postgresStore');
  }

  const agentId = plan.agentId ?? DEFAULT_AGENT_ID;
  const name = plan.name ?? DEFAULT_NAME;
  const maxSteps = plan.limits.maxSteps;

  const memory =
    useMemory && deps.mastra?.postgresStore != null
      ? new Memory({
          storage: deps.mastra.postgresStore,
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
    instructions: plan.instructions,
    model: deps.model as ConstructorParameters<typeof Agent>[0]['model'],
    ...(memory ? { memory } : {}),
  });

  const memoryOpts =
    useMemory && plan.memory.mode === 'mastra_pg'
      ? {
          memory: {
            thread: plan.memory.thread,
            resource: plan.memory.resource,
          },
        }
      : {};

  const mastraOutput = await mastraAgent.stream(plan.messages as MessageListInput, {
    stopWhen: stepCountIs(maxSteps),
    ...(deps.abortSignal != null ? { abortSignal: deps.abortSignal } : {}),
    ...memoryOpts,
  });

  const uiStream = toAISdkStream(mastraOutput, {
    from: 'agent',
    version: CENTRAI_UI_STREAM_VERSION,
  }) as ReadableStream<unknown>;

  const typedOutput = mastraOutput as MastraModelOutput;

  return {
    uiStream,
    text: typedOutput.text,
    usage: typedOutput.totalUsage.then((u) => ({
      inputTokens: u?.inputTokens ?? undefined,
      outputTokens: u?.outputTokens ?? undefined,
    })),
    raw: mastraOutput,
  };
}
