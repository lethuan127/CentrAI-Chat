import type { AgentRuntimeAdapter, AgentRuntimeId } from './types.js';
import { mastraAgentRuntimeAdapter } from './mastra/adapter.js';

export type CreateRuntimeAdapterOptions = { kind: AgentRuntimeId };

/** Selects an `AgentRuntimeAdapter`. v1 supports `mastra` only; add cases when new runtimes ship. */
export function createRuntimeAdapter(options: CreateRuntimeAdapterOptions): AgentRuntimeAdapter {
  switch (options.kind) {
    case 'mastra':
      return mastraAgentRuntimeAdapter;
    default: {
      const _kind = (options as CreateRuntimeAdapterOptions).kind;
      throw new Error(`Unknown agent runtime: ${String(_kind)}`);
    }
  }
}
