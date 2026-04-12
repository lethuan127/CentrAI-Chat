import type { RuntimeAgentDefinition } from '../domain/agent-definition.js';
import { formatSessionStateBlock } from '../domain/session-state.js';

/**
 * Assembles the Mastra `instructions` string from a validated agent definition.
 */
export function buildSystemPrompt(definition: RuntimeAgentDefinition): string {
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

  if (definition.toolRefs.length > 0) {
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
