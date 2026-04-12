import { z } from 'zod';

import { agentToolRefSchema } from './agent-tool-ref.js';

export const runtimeAgentDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  role: z.string(),
  instructions: z.string(),
  expectedOutput: z.string().nullable(),
  toolRefs: z.array(agentToolRefSchema),
  addSessionStateToContext: z.boolean(),
  maxTurnsMessageHistory: z.number().int().positive().nullable(),
  modelId: z.string().nullable().optional(),
  modelProvider: z.string().nullable().optional(),
  sessionState: z.record(z.unknown()).nullable().default(null),
});

export type RuntimeAgentDefinition = z.infer<typeof runtimeAgentDefinitionSchema>;
