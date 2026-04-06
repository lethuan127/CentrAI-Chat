'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import type { UIMessage } from 'ai';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { env } from '@/lib/env';
import { apiClient } from '@/lib/api-client';

export type ChatMessage = UIMessage;

export interface BranchGraphMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
}

interface UseChatOptions {
  agentId?: string;
  modelId?: string;
  providerId?: string;
  conversationId?: string;
  onConversationCreated?: (conversationId: string) => void;
  /**
   * IANA time zone sent with each chat request so the API can format "now" for the model.
   * Defaults to `Intl.DateTimeFormat().resolvedOptions().timeZone` in the browser.
   */
  getClientTimeZone?: () => string | undefined;
}

export interface ConversationMeta {
  modelId: string | null;
  agentName: string | null;
}

interface UseChatReturn {
  messages: UIMessage[];
  status: 'submitted' | 'streaming' | 'ready' | 'error';
  isLoadingHistory: boolean;
  error: Error | undefined;
  conversationId: string | null;
  branchGraph: BranchGraphMessage[];
  conversationMeta: ConversationMeta;
  sendMessage: (text: string) => void;
  regenerateAssistantBranch: (assistantMessageId: string) => void;
  switchActiveBranch: (focusMessageId: string) => Promise<void>;
  /** Edit user message (API), reload transcript, then regenerate — uses a new assistant branch when a reply already exists. */
  editUserMessageAndRegenerate: (messageId: string, newContent: string) => Promise<void>;
  stop: () => void;
  clearMessages: () => void;
  loadConversation: (id: string) => Promise<void>;
  setMessages: (messages: UIMessage[] | ((messages: UIMessage[]) => UIMessage[])) => void;
}

function toUiMessage(msg: {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}): UIMessage {
  return {
    id: msg.id,
    role: msg.role.toLowerCase() as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
  } as UIMessage;
}

function browserDefaultTimeZone(): string | undefined {
  if (typeof Intl === 'undefined') return undefined;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId ?? null,
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [branchGraph, setBranchGraph] = useState<BranchGraphMessage[]>([]);
  const [conversationMeta, setConversationMeta] = useState<ConversationMeta>({
    modelId: null,
    agentName: null,
  });

  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const branchFromAssistantRef = useRef<string | null>(null);
  const messagesRef = useRef<UIMessage[]>([]);

  const loadConversation = useCallback(
    async (
      id: string,
      setAiMessages: (m: UIMessage[]) => void,
      opts?: { silent?: boolean },
    ) => {
      if (!opts?.silent) setIsLoadingHistory(true);
      try {
        const envelope = await apiClient.get<
          Array<{
            id: string;
            role: string;
            content: string;
            createdAt: string;
            parentId?: string | null;
          }>
        >(`/chat/conversations/${id}/messages?limit=500`);

        const path = envelope.data;
        const meta = envelope.meta ?? {};
        const all = (meta.allMessages as BranchGraphMessage[] | undefined) ?? path;

        setBranchGraph(Array.isArray(all) ? all : []);
        setConversationMeta({
          modelId: (meta.modelId as string | null | undefined) ?? null,
          agentName: (meta.agentName as string | null | undefined) ?? null,
        });

        const uiMessages: UIMessage[] = path.map((msg) => toUiMessage(msg));
        setAiMessages(uiMessages);
        setConversationId(id);
      } catch {
        // Fail silently — conversation sidebar can show the error state
      } finally {
        if (!opts?.silent) setIsLoadingHistory(false);
      }
    },
    [],
  );

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
            branchFromAssistantMessageId: branchFromAssistantRef.current ?? undefined,
            timeZone:
              optionsRef.current.getClientTimeZone?.() ?? browserDefaultTimeZone(),
          },
        }),
      }),
    [],
  );

  const {
    messages,
    sendMessage: aiSendMessage,
    regenerate,
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
    onFinish: () => {
      branchFromAssistantRef.current = null;
      const cid = conversationIdRef.current;
      if (cid) {
        void loadConversation(cid, setMessages, { silent: true });
      }
    },
  });

  messagesRef.current = messages;

  const loadConversationWrapper = useCallback(
    async (id: string) => {
      await loadConversation(id, setMessages);
    },
    [loadConversation, setMessages],
  );

  // Always load transcript when the URL / parent passes a conversation id.
  // Do not compare to conversationIdRef: on refresh we initialize state from the same id,
  // so ref would match and we'd skip the fetch (empty thread until the user sends a message).
  useEffect(() => {
    const id = options.conversationId;
    if (!id) return;
    void loadConversationWrapper(id);
  }, [options.conversationId, loadConversationWrapper]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      branchFromAssistantRef.current = null;
      aiSendMessage({ text: text.trim() });
    },
    [aiSendMessage],
  );

  const regenerateAssistantBranch = useCallback(
    (assistantMessageId: string) => {
      if (!conversationIdRef.current) return;
      branchFromAssistantRef.current = assistantMessageId;
      void regenerate({ messageId: assistantMessageId });
    },
    [regenerate],
  );

  const switchActiveBranch = useCallback(
    async (focusMessageId: string) => {
      const id = conversationIdRef.current;
      if (!id) return;
      await apiClient.patch(`/chat/conversations/${id}/active-leaf`, {
        messageId: focusMessageId,
      });
      await loadConversationWrapper(id);
    },
    [loadConversationWrapper],
  );

  const editUserMessageAndRegenerate = useCallback(
    async (messageId: string, newContent: string) => {
      const trimmed = newContent.trim();
      if (!trimmed) return;
      const cid = conversationIdRef.current;
      if (!cid) return;

      const list = messagesRef.current;
      const idx = list.findIndex((m) => m.id === messageId);
      const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : undefined;
      branchFromAssistantRef.current =
        next?.role === 'assistant' ? next.id : null;

      await apiClient.patch(`/chat/conversations/${cid}/messages/${messageId}`, {
        content: trimmed,
      });
      await loadConversation(cid, setMessages, { silent: true });
      void regenerate({ messageId });
    },
    [loadConversation, regenerate, setMessages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setBranchGraph([]);
    setConversationMeta({ modelId: null, agentName: null });
  }, [setMessages]);

  return {
    messages,
    status,
    isLoadingHistory,
    error,
    conversationId,
    branchGraph,
    conversationMeta,
    sendMessage,
    regenerateAssistantBranch,
    switchActiveBranch,
    editUserMessageAndRegenerate,
    stop,
    clearMessages,
    loadConversation: loadConversationWrapper,
    setMessages,
  };
}
