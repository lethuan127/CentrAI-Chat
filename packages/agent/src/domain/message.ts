export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Optional tool call id when role is tool. */
  toolCallId?: string;
  name?: string;
}

export interface SliceHistoryOptions {
  /** Keep at most this many *turns* (user → assistant pairs). Last partial turn is kept. */
  maxTurns?: number;
}

/**
 * Trims message list to the last `maxTurns` user-led turns.
 * Counts messages starting at each `user` role; keeps from the Nth-from-last user onward.
 */
export function sliceMessageHistory(
  messages: readonly ChatMessage[],
  options: SliceHistoryOptions,
): ChatMessage[] {
  const { maxTurns } = options;
  if (maxTurns == null || maxTurns <= 0 || messages.length === 0) {
    return [...messages];
  }

  const userIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user') {
      userIndices.push(i);
    }
  }

  if (userIndices.length <= maxTurns) {
    return [...messages];
  }

  const start = userIndices[userIndices.length - maxTurns];
  return messages.slice(start);
}

export function appendMessages(
  base: readonly ChatMessage[],
  extra: readonly ChatMessage[],
): ChatMessage[] {
  return [...base, ...extra];
}
