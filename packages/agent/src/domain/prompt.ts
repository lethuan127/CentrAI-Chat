import { formatSessionStateBlock, type SessionState } from './session-state.js';

export interface SystemPromptInput {
  role: string;
  instructions: string;
  expectedOutput?: string | null;
  /** Shown to the model when you want the agent to know its display name. */
  name?: string;
  description?: string | null;
  /** Injected as its own section when `includeSessionState` is true. */
  sessionState?: SessionState | null;
  includeSessionState?: boolean;
}

/**
 * Builds a single system prompt string from role, instructions, and optional sections.
 * Matches the platform convention: markdown-ish headings per section.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
  const parts: string[] = [];

  if (input.name?.trim()) {
    parts.push(`# Agent\n**Name:** ${input.name.trim()}`);
  }
  if (input.description?.trim()) {
    parts.push(`**Description:** ${input.description.trim()}`);
  }
  if (input.role?.trim()) {
    parts.push(`# Role\n${input.role.trim()}`);
  }
  if (input.instructions?.trim()) {
    parts.push(`# Instructions\n${input.instructions.trim()}`);
  }
  if (input.expectedOutput?.trim()) {
    parts.push(`# Expected Output\n${input.expectedOutput.trim()}`);
  }

  if (input.includeSessionState) {
    const block = formatSessionStateBlock(input.sessionState ?? null);
    if (block) {
      parts.push(`# Session state\n\`\`\`json\n${block}\n\`\`\``);
    }
  }

  return parts.join('\n\n');
}
