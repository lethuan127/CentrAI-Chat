import { COMPILED_RUN_PLAN_VERSION, type CompiledRunPlan } from '../../compile/compiled-run-plan.js';
import type { AdapterDeps, AgentRuntimeAdapter, StreamRunResult } from '../types.js';
import { executeMastraStreamRun } from './stream-run.js';

/** First shipped runtime: Mastra `Agent` + `toAISdkStream` (AI SDK v6 UI chunks). */
export const mastraAgentRuntimeAdapter: AgentRuntimeAdapter = {
  id: 'mastra',

  streamRun(plan: CompiledRunPlan, deps: AdapterDeps): Promise<StreamRunResult> {
    return executeMastraStreamRun(plan, deps);
  },

  supports(plan: CompiledRunPlan): { ok: true } | { ok: false; reason: string } {
    if (plan.planVersion !== COMPILED_RUN_PLAN_VERSION) {
      return {
        ok: false,
        reason: `Unsupported plan version ${plan.planVersion}; expected ${COMPILED_RUN_PLAN_VERSION}`,
      };
    }
    return { ok: true };
  },
};
