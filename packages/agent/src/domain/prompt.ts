import type { RuntimeAgentDefinition } from './agent-definition.js';
import { formatSessionStateBlock } from './session-state.js';

/**
 * Builds a single system prompt string from role, instructions, and optional sections.
 * Matches the platform convention: markdown-ish headings per section.
 */
export function buildSystemPrompt(def: RuntimeAgentDefinition): string {
  const parts: string[] = [];

  if (def.name?.trim()) {
    parts.push(`# Agent\n**Name:** ${def.name.trim()}`);
  }
  if (def.description?.trim()) {
    parts.push(`**Description:** ${def.description.trim()}`);
  }
  if (def.role?.trim()) {
    parts.push(`# Role\n${def.role.trim()}`);
  }
  if (def.instructions?.trim()) {
    parts.push(`# Instructions\n${def.instructions.trim()}`);
  }
  if (def.expectedOutput?.trim()) {
    parts.push(`# Expected Output\n${def.expectedOutput.trim()}`);
  }

  if (def.addSessionStateToContext) {
    const block = formatSessionStateBlock(def.sessionState ?? null);
    if (block) {
      parts.push(`# Session state\n\`\`\`json\n${block}\n\`\`\``);
    }
  }

  return parts.join('\n\n');
}
