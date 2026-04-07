import type { PostgresStore } from '@mastra/pg';

import type { CompiledRunPlan } from '../compile/compiled-run-plan.js';

/** Per-request dependencies injected by the API (no Prisma / HTTP here). */
export interface AdapterDeps {
  model: unknown;
  /** When the HTTP client disconnects, abort to stop the model and release resources. */
  abortSignal?: AbortSignal;
  mastra?: {
    postgresStore?: PostgresStore;
  };
}

/** Normalized result for `apps/api` (UI stream + post-run persistence fields). */
export interface StreamRunResult {
  /** AI SDK v6 UI message stream parts for `writer.merge` / piping. */
  uiStream: ReadableStream<unknown>;
  text: Promise<string>;
  usage?: Promise<{ inputTokens?: number; outputTokens?: number } | undefined>;
  /** Framework handle for callers that still need Mastra-specific fields. */
  raw?: unknown;
}

export type AgentRuntimeId = 'mastra';

export interface AgentRuntimeAdapter {
  readonly id: AgentRuntimeId;

  streamRun(plan: CompiledRunPlan, deps: AdapterDeps): Promise<StreamRunResult>;

  supports(plan: CompiledRunPlan): { ok: true } | { ok: false; reason: string };
}
