'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { UIMessage } from 'ai';
import {
  MessageSquare,
  Plus,
  Search,
  Trash2,
  PenLine,
  LogOut,
  Settings,
  Shield,
  Bot,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { useConversations, type ConversationListItem } from '@/hooks/use-conversations';
import { usePublishedAgents, type PublishedAgentItem } from '@/hooks/use-published-agents';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { Shimmer } from '@/components/ai-elements/shimmer';

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('');
}

function ChatMessageItem({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  const text = getMessageText(message);
  const isAssistantStreaming = isStreaming && message.role === 'assistant';

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === 'user' ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : text ? (
          <MessageResponse isAnimating={isAssistantStreaming}>{text}</MessageResponse>
        ) : isAssistantStreaming ? (
          <Shimmer duration={1}>Thinking...</Shimmer>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  isLoading,
}: {
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filtered = search
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(search.toLowerCase()) ||
          c.agentName?.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  const grouped = groupByDate(filtered);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <button
          onClick={onNew}
          className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {search ? 'No matching conversations' : 'No conversations yet'}
          </p>
        ) : (
          Object.entries(grouped).map(([label, items]) => (
            <div key={label} className="mb-2">
              <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              {items.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    conv.id === activeId
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-accent',
                  )}
                  onClick={() => onSelect(conv.id)}
                >
                  {conv.agentName ? (
                    <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  {editingId === conv.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => {
                        if (editTitle.trim()) onRename(conv.id, editTitle.trim());
                        setEditingId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editTitle.trim()) onRename(conv.id, editTitle.trim());
                          setEditingId(null);
                        }
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 truncate bg-transparent text-xs outline-none"
                    />
                  ) : (
                    <span className="flex-1 truncate text-xs">
                      {conv.title || 'New Conversation'}
                    </span>
                  )}

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(conv.id);
                        setEditTitle(conv.title || '');
                      }}
                      className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <PenLine className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(conv.id);
                      }}
                      className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AgentPicker({
  agents,
  selectedId,
  onSelect,
}: {
  agents: PublishedAgentItem[];
  selectedId: string | null;
  onSelect: (agent: PublishedAgentItem | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = agents.find((a) => a.id === selectedId);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
      >
        {selected ? (
          <>
            <Bot className="h-4 w-4 text-primary" />
            <span className="max-w-[200px] truncate font-medium">{selected.name}</span>
          </>
        ) : (
          <>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Direct Chat</span>
          </>
        )}
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-popover p-1 shadow-lg">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                !selectedId && 'bg-accent',
              )}
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">Direct Chat</p>
                <p className="text-xs text-muted-foreground">Chat with the default model</p>
              </div>
            </button>

            {agents.length > 0 && (
              <>
                <div className="my-1 border-t border-border" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Agents
                </p>
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onSelect(agent);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                      selectedId === agent.id && 'bg-accent',
                    )}
                  >
                    <Bot className="h-4 w-4 text-primary" />
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium">{agent.name}</p>
                      {agent.description && (
                        <p className="truncate text-xs text-muted-foreground">
                          {agent.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function groupByDate(conversations: ConversationListItem[]) {
  const groups: Record<string, ConversationListItem[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const week = new Date(today.getTime() - 7 * 86_400_000);

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    let label: string;
    if (date >= today) label = 'Today';
    else if (date >= yesterday) label = 'Yesterday';
    else if (date >= week) label = 'Previous 7 days';
    else label = 'Older';

    if (!groups[label]) groups[label] = [];
    groups[label].push(conv);
  }

  return groups;
}

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();

  const activeConversationId = searchParams.get('c');
  const initialAgentId = searchParams.get('agent');

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(initialAgentId);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { agents } = usePublishedAgents();
  const {
    conversations,
    isLoading: conversationsLoading,
    fetchConversations,
    deleteConversation,
    renameConversation,
  } = useConversations();

  const handleConversationCreated = useCallback(
    (newId: string) => {
      router.replace(`/chat?c=${newId}`, { scroll: false });
      fetchConversations();
    },
    [router, fetchConversations],
  );

  const {
    messages,
    status,
    isLoadingHistory,
    error,
    sendMessage,
    stop,
    clearMessages,
  } = useChat({
    agentId: selectedAgentId ?? undefined,
    conversationId: activeConversationId ?? undefined,
    onConversationCreated: handleConversationCreated,
  });

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      router.push(`/chat?c=${id}`, { scroll: false });
    },
    [router],
  );

  const handleNewChat = useCallback(() => {
    clearMessages();
    setSelectedAgentId(null);
    router.push('/chat', { scroll: false });
  }, [clearMessages, router]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (activeConversationId === id) handleNewChat();
    },
    [deleteConversation, activeConversationId, handleNewChat],
  );

  const handleSelectAgent = useCallback(
    (agent: PublishedAgentItem | null) => {
      setSelectedAgentId(agent?.id ?? null);
      if (activeConversationId) {
        clearMessages();
        router.push('/chat', { scroll: false });
      }
    },
    [activeConversationId, clearMessages, router],
  );

  const handlePromptSubmit = (msg: PromptInputMessage) => {
    const trimmed = msg.text.trim();
    if (!trimmed || status !== 'ready') return;
    sendMessage(trimmed);
  };

  const isAdminOrDev = user?.role === 'ADMIN' || user?.role === 'DEVELOPER';
  const lastMessage = messages[messages.length - 1];
  const isStreaming = status === 'streaming' || status === 'submitted';
  const isLastAssistantStreaming = isStreaming && lastMessage?.role === 'assistant';

  return (
    <div className="flex h-full">
      <aside
        className={cn(
          'flex h-full flex-col border-r border-border bg-muted/30 transition-all duration-200',
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0',
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Link href="/chat" className="text-lg font-bold tracking-tight">
            CentrAI
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ConversationSidebar
            conversations={conversations}
            activeId={activeConversationId}
            onSelect={handleSelectConversation}
            onNew={handleNewChat}
            onDelete={handleDeleteConversation}
            onRename={renameConversation}
            isLoading={conversationsLoading}
          />
        </div>

        <div className="space-y-0.5 border-t border-border px-2 py-2">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          {isAdminOrDev && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin Panel
            </Link>
          )}
          <div className="flex items-center gap-3 px-3 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <span className="flex-1 truncate text-xs font-medium">
              {user?.name || user?.email}
            </span>
            <button
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <AgentPicker agents={agents} selectedId={selectedAgentId} onSelect={handleSelectAgent} />
          <div className="flex-1" />
        </div>

        {isLoadingHistory ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <ConversationEmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="Start a conversation"
            description={
              selectedAgentId
                ? `Chat with ${agents.find((a) => a.id === selectedAgentId)?.name ?? 'agent'}`
                : 'Type a message below to begin chatting.'
            }
            className="flex-1"
          />
        ) : (
          <Conversation className="flex-1">
            <ConversationContent className="mx-auto max-w-3xl">
              {messages.map((msg, idx) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  isStreaming={isLastAssistantStreaming && idx === messages.length - 1}
                />
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        )}

        {error && (
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-sm text-destructive">
            <span>{error.message}</span>
          </div>
        )}

        <div className="border-t bg-background px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <PromptInput onSubmit={handlePromptSubmit}>
              <PromptInputTextarea placeholder="Type a message..." />
              <PromptInputFooter>
                <div />
                <PromptInputSubmit status={status} onStop={stop} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </div>
  );
}
