'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { env } from '@/lib/env';
import { apiClient } from '@/lib/api-client';

export type ChatMessage = UIMessage;

interface UseChatOptions {
  agentId?: string;
  modelId?: string;
  providerId?: string;
  conversationId?: string;
  onConversationCreated?: (conversationId: string) => void;
}

interface UseChatReturn {
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  isLoadingHistory: boolean;
  error: Error | undefined;
  conversationId: string | null;
  sendMessage: (text: string) => void;
  stop: () => void;
  clearMessages: () => void;
  loadConversation: (id: string) => Promise<void>;
  setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId ?? null,
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${env.apiUrl}/api/v1/chat/messages`,
        prepareSendMessagesRequest: (reqOptions) => ({
          headers: {
            ...((typeof reqOptions.headers === 'object' && reqOptions.headers !== null)
              ? reqOptions.headers
              : {}),
            Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('accessToken') ?? '' : ''}`,
          },
          // Custom body replaces HttpChatTransport defaults — must include `messages` or the API gets an empty array.
          body: {
            ...(reqOptions.body ?? {}),
            id: reqOptions.id,
            messages: reqOptions.messages,
            trigger: reqOptions.trigger,
            messageId: reqOptions.messageId,
            conversationId: conversationIdRef.current ?? undefined,
            agentId: optionsRef.current.agentId ?? undefined,
            modelId: optionsRef.current.modelId ?? undefined,
            providerId: optionsRef.current.providerId ?? undefined,
          },
        }),
      }),
    [],
  );

  const {
    messages,
    sendMessage: aiSendMessage,
    status,
    error,
    stop,
    setMessages,
  } = useAIChat({
    transport,
    onData: (dataPart) => {
      const data = dataPart as unknown as Record<string, unknown>;
      const cid =
        (data?.data as Record<string, unknown>)?.conversationId ??
        data?.conversationId;
      if (typeof cid === 'string' && cid !== conversationIdRef.current) {
        setConversationId(cid);
        optionsRef.current.onConversationCreated?.(cid);
      }
    },
  });

  const loadConversation = useCallback(
    async (id: string) => {
      setIsLoadingHistory(true);
      try {
        const res = await apiClient.get<
          Array<{ id: string; role: string; content: string; createdAt: string }>
        >(`/chat/conversations/${id}/messages?limit=100`);

        const uiMessages: UIMessage[] = res.data.map((msg) => ({
          id: msg.id,
          role: msg.role.toLowerCase() as 'user' | 'assistant',
          content: msg.content,
          parts: [{ type: 'text' as const, text: msg.content }],
          createdAt: new Date(msg.createdAt),
        }));

        setMessages(uiMessages);
        setConversationId(id);
      } catch {
        // Fail silently — conversation sidebar can show the error state
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [setMessages],
  );

  useEffect(() => {
    if (options.conversationId && options.conversationId !== conversationIdRef.current) {
      loadConversation(options.conversationId);
    }
  }, [options.conversationId, loadConversation]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      aiSendMessage({ text: text.trim() });
    },
    [aiSendMessage],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
  }, [setMessages]);

  return {
    messages,
    status,
    isLoadingHistory,
    error,
    conversationId,
    sendMessage,
    stop,
    clearMessages,
    loadConversation,
    setMessages,
  };
}
