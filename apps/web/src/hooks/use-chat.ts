'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatStreamEvent, SendMessageDto } from '@centrai/types';
import { env } from '@/lib/env';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface UseChatOptions {
  agentId?: string;
  modelId?: string;
  conversationId?: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  stopStreaming: () => Promise<void>;
  clearMessages: () => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeMessageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const token = localStorage.getItem('accessToken');
        const body: SendMessageDto = {
          content,
          conversationId: options.conversationId,
          agentId: options.agentId,
          modelId: options.modelId,
        };

        const res = await fetch(`${env.apiUrl}/api/v1/chat/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        const serverMessageId = res.headers.get('X-Message-Id');
        if (serverMessageId) {
          activeMessageIdRef.current = serverMessageId;
        }

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(errorText || `HTTP ${res.status}`);
        }

        if (!res.body) {
          throw new Error('Response body is empty');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const dataLine = line.trim();
            if (!dataLine.startsWith('data: ')) continue;

            const json = dataLine.slice(6);
            const event = JSON.parse(json) as ChatStreamEvent;

            switch (event.event) {
              case 'token':
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: msg.content + event.data.content }
                      : msg,
                  ),
                );
                break;

              case 'done':
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, id: event.data.messageId, isStreaming: false }
                      : msg,
                  ),
                );
                break;

              case 'stopped':
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, content: event.data.content, isStreaming: false }
                      : msg,
                  ),
                );
                break;

              case 'error':
                setError(event.data.message);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessage.id
                      ? { ...msg, isStreaming: false }
                      : msg,
                  ),
                );
                break;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;

        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.isStreaming ? { ...msg, isStreaming: false } : msg,
          ),
        );
      } finally {
        setIsStreaming(false);
        activeMessageIdRef.current = null;
        abortControllerRef.current = null;
      }
    },
    [isStreaming, options.conversationId, options.agentId, options.modelId],
  );

  const stopStreaming = useCallback(async () => {
    const messageId = activeMessageIdRef.current;
    if (messageId) {
      const token = localStorage.getItem('accessToken');
      await fetch(`${env.apiUrl}/api/v1/chat/messages/${messageId}/stop`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }).catch(() => {});
    }
    abortControllerRef.current?.abort();
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isStreaming, error, sendMessage, stopStreaming, clearMessages };
}
