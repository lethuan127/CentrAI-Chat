import { z } from 'zod';

/** Minimal tool attachment on an agent — identifiers only (no Mastra imports). */
export const agentToolRefSchema = z.object({
  name: z.string().min(1),
});

export type AgentToolRef = z.infer<typeof agentToolRefSchema>;

function dedupeByName(refs: AgentToolRef[]): AgentToolRef[] {
  const seen = new Set<string>();
  const out: AgentToolRef[] = [];
  for (const r of refs) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    out.push(r);
  }
  return out;
}

/**
 * Parses persisted `Agent.tools` JSON: `{ name: string }[]` or string ids.
 */
export function parseAgentToolRefsFromJson(value: unknown): AgentToolRef[] {
  if (value == null || !Array.isArray(value)) {
    return [];
  }

  const out: AgentToolRef[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      out.push({ name: item.trim() });
    } else if (typeof item === 'object' && item !== null && 'name' in item) {
      const n = (item as { name?: unknown }).name;
      if (typeof n === 'string' && n.trim()) {
        out.push({ name: n.trim() });
      }
    }
  }
  return dedupeByName(out);
}
