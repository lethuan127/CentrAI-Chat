import type { ModelMessage } from 'ai';

/**
 * Trims the message list so it contains at most `maxTurns` user turns (counting from the end).
 * A "turn" is one user message; all messages from that user message onward are included, preserving
 * any assistant responses that follow. Pure helper; does not mutate the input array.
 */
export function trimModelMessagesToMaxTurns(
  messages: ModelMessage[],
  maxTurns: number,
): ModelMessage[] {
  if (maxTurns <= 0 || messages.length === 0) {
    return messages;
  }

  let userTurns = 0;
  let start = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.role === 'user') {
      userTurns++;
      if (userTurns === maxTurns) {
        start = i;
        break;
      }
    }
  }

  return messages.slice(start);
}
