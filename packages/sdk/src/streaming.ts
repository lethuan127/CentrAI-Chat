/**
 * Utilities for consuming Server-Sent Events (SSE) streams from the CentrAI API.
 * Works with the Vercel AI SDK UI message stream format.
 */

export interface StreamCallbacks {
  onToken?: (token: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: string) => void;
  onConversationCreated?: (conversationId: string) => void;
}

/**
 * Read an SSE stream and invoke callbacks as events arrive.
 * Returns the full accumulated text once the stream completes.
 */
export async function consumeStream(
  stream: ReadableStream<Uint8Array>,
  callbacks?: StreamCallbacks,
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('0:')) {
          const token = trimmed.slice(2).replace(/^"/, '').replace(/"$/, '');
          fullText += token;
          callbacks?.onToken?.(token);
        } else if (trimmed.startsWith('d:')) {
          try {
            const data = JSON.parse(trimmed.slice(2));
            if (data.conversationId) {
              callbacks?.onConversationCreated?.(data.conversationId);
            }
          } catch {
            // non-JSON data event
          }
        } else if (trimmed.startsWith('e:')) {
          try {
            const data = JSON.parse(trimmed.slice(2));
            callbacks?.onDone?.(fullText);
            if (data.finishReason === 'error') {
              callbacks?.onError?.(data.error ?? 'Unknown stream error');
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  callbacks?.onDone?.(fullText);
  return fullText;
}
