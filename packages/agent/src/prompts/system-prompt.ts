import type { Tool as MastraTool } from '@mastra/core/tools';
import type { ZodObject, ZodTypeAny } from 'zod';

import type { CentrAITools } from '../tools/centrai-tools.js';
import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { formatSessionStateBlock } from '../domain/session-state.js';

/**
 * Assembles the Mastra `instructions` string from a validated agent definition.
 *
 * @param definition    - The validated agent definition.
 * @param resolvedTools - Optional map of resolved Mastra tools. When provided,
 *   each tool's description and parameter list are included in the system prompt
 *   so the model understands how to call each tool correctly.
 * @param toolkits      - Optional list of {@link CentrAITools} instances whose
 *   `instructions` are prepended to the tool listing so the LLM knows each
 *   toolkit's overall purpose and usage guidelines.
 */
export function buildSystemPrompt(
  definition: RuntimeAgentDefinition,
  resolvedTools?: Record<string, MastraTool>,
  toolkits?: CentrAITools[],
): string {
  const sections: string[] = [];

  sections.push(`You are acting as: ${definition.role.trim()}`);
  sections.push(`Agent name: ${definition.name.trim()}`);

  if (definition.description?.trim()) {
    sections.push(`Description: ${definition.description.trim()}`);
  }

  sections.push('');
  sections.push(definition.instructions.trim());

  if (definition.expectedOutput?.trim()) {
    sections.push('');
    sections.push('Expected output style:');
    sections.push(definition.expectedOutput.trim());
  }

  const toolEntries = resolvedTools ? Object.values(resolvedTools) : [];
  if (toolEntries.length > 0) {
    sections.push('');
    sections.push('## Available Tools');

    // Toolkit-level instructions come first so the LLM understands each
    // toolkit's purpose before reading individual tool schemas.
    if (toolkits?.length) {
      for (const toolkit of toolkits) {
        const inst = toolkit.instructions.trim();
        if (inst) {
          sections.push('');
          sections.push(inst);
        }
      }
    }

    for (const tool of toolEntries) {
      sections.push('');
      sections.push(`### ${tool.id}`);
      sections.push(tool.description);
      const paramBlock = formatToolParams(tool);
      if (paramBlock) {
        sections.push('Parameters:');
        sections.push(paramBlock);
      }
    }
  } else if (definition.toolRefs.length > 0) {
    // Fallback when tools haven't been resolved yet — list names only.
    const names = definition.toolRefs.map((t) => t.name).join(', ');
    sections.push('');
    sections.push(`Tools attached to this agent (by name): ${names}.`);
  }

  if (definition.addSessionStateToContext) {
    const block = formatSessionStateBlock(definition.sessionState);
    if (block) {
      sections.push('');
      sections.push('Session context (JSON):');
      sections.push(block);
    } else {
      sections.push('');
      sections.push(
        'When session context is provided by the application, incorporate it naturally without repeating it verbatim unless helpful.',
      );
    }
  }

  if (definition.maxTurnsMessageHistory != null) {
    sections.push('');
    sections.push(
      `Prefer focusing on recent dialogue; message history may be trimmed to roughly the last ${definition.maxTurnsMessageHistory} user turns.`,
    );
  }

  return sections.join('\n');
}

/**
 * Prepends an optional session block (timezone, prefs) to the system prompt.
 * For session preamble from the API, callers prepend text before the model run (see `apps/api` chat route).
 */
export function mergeSessionIntoSystemPrompt(systemPrompt: string, sessionBlock?: string | null): string {
  const base = systemPrompt.trimEnd();
  const extra = sessionBlock?.trim();
  if (!extra) {
    return base;
  }
  return `${extra}\n\n${base}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders the Zod input schema of a Mastra tool into a human-readable
 * parameter list, e.g.:
 *
 * ```
 * - url (string, required): The URL to scrape.
 * - limit (number, optional): Maximum pages to crawl.
 * ```
 *
 * Returns `null` when the tool has no input schema or it has no fields.
 */
function formatToolParams(tool: { inputSchema?: unknown }): string | null {
  const schema = tool.inputSchema;
  if (!isZodObject(schema)) return null;

  const lines: string[] = [];
  for (const [key, field] of Object.entries(schema.shape as Record<string, ZodTypeAny>)) {
    const isOptional = field.isOptional();
    const typeName = resolveZodTypeName(field);
    const description = (field as { description?: string }).description;
    const qualifier = isOptional ? 'optional' : 'required';
    const descSuffix = description ? `: ${description}` : '';
    lines.push(`- ${key} (${typeName}, ${qualifier})${descSuffix}`);
  }

  return lines.length > 0 ? lines.join('\n') : null;
}

function isZodObject(schema: unknown): schema is ZodObject<Record<string, ZodTypeAny>> {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    '_def' in schema &&
    (schema as { _def: { typeName?: string } })._def?.typeName === 'ZodObject'
  );
}

function resolveZodTypeName(field: ZodTypeAny): string {
  const def = (field as { _def?: { typeName?: string; innerType?: ZodTypeAny } })._def;
  if (!def?.typeName) return 'any';

  // Unwrap ZodOptional / ZodDefault to expose the inner type name.
  if (def.typeName === 'ZodOptional' || def.typeName === 'ZodDefault') {
    return resolveZodTypeName(def.innerType as ZodTypeAny);
  }

  const map: Record<string, string> = {
    ZodString: 'string',
    ZodNumber: 'number',
    ZodBoolean: 'boolean',
    ZodArray: 'array',
    ZodObject: 'object',
    ZodEnum: 'enum',
    ZodUnion: 'union',
    ZodNull: 'null',
  };
  return map[def.typeName] ?? def.typeName.replace(/^Zod/, '').toLowerCase();
}
