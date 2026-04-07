import { z } from 'zod';

/** OpenAI-style JSON Schema object for function parameters (serializable). */
export const jsonParametersSchema = z.record(z.unknown());

const functionToolSchema = z.object({
  type: z.literal('function'),
  name: z.string().min(1),
  description: z.string().optional(),
  parameters: jsonParametersSchema.default({}),
});

const mcpToolSchema = z.object({
  type: z.literal('mcp'),
  /** Logical id for this MCP attachment (e.g. workspace MCP server row id). */
  serverId: z.string().min(1).optional(),
  /** Transport endpoint when not using a persisted server id. */
  serverUrl: z.string().url().optional(),
  /** If omitted, all tools exposed by the server are candidates. */
  toolNames: z.array(z.string().min(1)).optional(),
});

export type RuntimeFunctionTool = z.infer<typeof functionToolSchema>;
export type RuntimeMcpTool = z.infer<typeof mcpToolSchema>;

export type RuntimeTool =
  | RuntimeFunctionTool
  | RuntimeMcpTool
  | {
      type: 'toolkit';
      id: string;
      label?: string;
      description?: string;
      tools: RuntimeTool[];
    };

export type RuntimeToolkitTool = Extract<RuntimeTool, { type: 'toolkit' }>;

export const runtimeToolSchema: z.ZodType<RuntimeTool> = z.lazy(() =>
  z.union([
    functionToolSchema,
    mcpToolSchema,
    z.object({
      type: z.literal('toolkit'),
      id: z.string().min(1),
      label: z.string().optional(),
      description: z.string().optional(),
      tools: z.array(runtimeToolSchema as z.ZodType<RuntimeTool>),
    }),
  ]),
) as z.ZodType<RuntimeTool>;

export function parseRuntimeTools(value: unknown): RuntimeTool[] {
  const parsed = z.array(runtimeToolSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function flattenRuntimeTools(tools: RuntimeTool[]): RuntimeTool[] {
  const out: RuntimeTool[] = [];
  for (const t of tools) {
    if (t.type === 'toolkit') {
      out.push(...flattenRuntimeTools(t.tools));
    } else {
      out.push(t);
    }
  }
  return out;
}
