import type { UIMessage } from 'ai';

export interface ExtractedThinking {
  reasoning: string;
}

export interface ExtractedToolInvocation {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: unknown;
}

export interface ExtractedParts {
  text: string;
  thinking: ExtractedThinking[];
  toolInvocations: ExtractedToolInvocation[];
}

type AnyPart = { type: string } & Record<string, unknown>;

export function extractMessageParts(message: UIMessage): ExtractedParts {
  const text: string[] = [];
  const thinking: ExtractedThinking[] = [];
  const toolInvocations: ExtractedToolInvocation[] = [];

  if (message.role !== 'assistant') {
    return { text: '', thinking: [], toolInvocations: [] };
  }

  for (const rawPart of (message.parts ?? []) as AnyPart[]) {
    if (rawPart.type === 'text' && typeof rawPart.text === 'string') {
      text.push(rawPart.text);
    } else if (rawPart.type === 'reasoning' && typeof rawPart.text === 'string') {
      // AI SDK v6: ReasoningUIPart uses `.text` (not `.reasoning`)
      thinking.push({ reasoning: rawPart.text });
    } else if (
      rawPart.type === 'dynamic-tool' &&
      rawPart.state === 'output-available' &&
      typeof rawPart.toolCallId === 'string' &&
      typeof rawPart.toolName === 'string'
    ) {
      // DynamicToolUIPart: toolName is a direct field, uses input/output
      toolInvocations.push({
        toolCallId: rawPart.toolCallId,
        toolName: rawPart.toolName,
        args: rawPart.input,
        result: rawPart.output,
      });
    } else if (
      typeof rawPart.type === 'string' &&
      rawPart.type.startsWith('tool-') &&
      rawPart.type !== 'dynamic-tool' &&
      rawPart.state === 'output-available' &&
      typeof rawPart.toolCallId === 'string'
    ) {
      // Typed ToolUIPart: type is `tool-{name}`, no separate toolName field
      const toolName = rawPart.type.slice('tool-'.length);
      toolInvocations.push({
        toolCallId: rawPart.toolCallId,
        toolName,
        args: rawPart.input,
        result: rawPart.output,
      });
    }
  }

  return {
    text: text.join(''),
    thinking,
    toolInvocations,
  };
}
