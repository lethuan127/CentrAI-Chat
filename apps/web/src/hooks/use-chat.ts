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

interface ApiMessageRow {
  id: string;
  role: string;
  content: string;
  contentType?: string | null;
  createdAt: string;
  parentId?: string | null;
  toolCallId?: string | null;
  toolName?: string | null;
  toolArgs?: unknown;
  toolResult?: unknown;
}

interface UseChatOptions {
  agentId?: string;
  modelId?: string;
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

/**
 * Reconstruct UIMessage.parts from a set of API rows.
 * Sub-rows (THINKING, TOOL_CALL) are children of an ASSISTANT TEXT row and carry
 * the reasoning and tool invocation data needed to re-hydrate the parts array.
 */
function buildUiMessage(main: ApiMessageRow, children: ApiMessageRow[]): UIMessage {
  const role = main.role.toLowerCase() as 'user' | 'assistant';

  if (role === 'user') {
    return {
      id: main.id,
      role: 'user',
      parts: [{ type: 'text' as const, text: main.content }],
    } as UIMessage;
  }

  // Build parts in stream order: reasoning first, then tools, then text
  const parts: Record<string, unknown>[] = [];

  for (const child of children) {
    if (child.contentType === 'THINKING') {
      // ReasoningUIPart in AI SDK v6 uses `.text`
      parts.push({ type: 'reasoning', text: child.content });
    } else if (
      child.contentType === 'TOOL_CALL' &&
      child.toolCallId &&
      child.toolName
    ) {
      // DynamicToolUIPart with state output-available
      parts.push({
        type: 'dynamic-tool',
        state: 'output-available',
        toolCallId: child.toolCallId,
        toolName: child.toolName,
        input: child.toolArgs ?? null,
        output: child.toolResult ?? null,
      });
    }
  }

  if (main.content) {
    parts.push({ type: 'text' as const, text: main.content });
  }

  return {
    id: main.id,
    role: 'assistant',
    parts,
  } as UIMessage;
}

/**
 * Convert a flat list of API rows (including THINKING + TOOL_CALL sub-rows)
 * into hydrated UIMessages. Sub-rows are merged into the parent ASSISTANT row's parts.
 */
function hydrateMessages(rows: ApiMessageRow[]): UIMessage[] {
  // Separate main path rows from sub-rows
  const mainRows = rows.filter(
    (r) => !r.contentType || r.contentType === 'TEXT',
  );
  const subRows = rows.filter(
    (r) => r.contentType === 'THINKING' || r.contentType === 'TOOL_CALL',
  );

  // Index sub-rows by parentId
  const childrenByParent = new Map<string, ApiMessageRow[]>();
  for (const sub of subRows) {
    if (!sub.parentId) continue;
    const arr = childrenByParent.get(sub.parentId) ?? [];
    arr.push(sub);
    childrenByParent.set(sub.parentId, arr);
  }

  return mainRows
    .filter((r) => r.role === 'USER' || r.role === 'ASSISTANT')
    .map((row) => buildUiMessage(row, childrenByParent.get(row.id) ?? []));
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
        const envelope = await apiClient.get<ApiMessageRow[]>(
          `/chat/conversations/${id}/messages?limit=500`,
        );

        const path = envelope.data;
        const meta = envelope.meta ?? {};

        // allMessages (for branch graph) is always main-role rows only
        const rawAll = (meta.allMessages as ApiMessageRow[] | undefined) ?? path;
        const graphRows = rawAll.filter(
          (m) => !m.contentType || m.contentType === 'TEXT',
        );
        setBranchGraph(Array.isArray(graphRows) ? graphRows : []);
        setConversationMeta({
          modelId: (meta.modelId as string | null | undefined) ?? null,
          agentName: (meta.agentName as string | null | undefined) ?? null,
        });

        const uiMessages = hydrateMessages(path);
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
