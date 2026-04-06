'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  FileJson,
  FileText,
  X,
  Cpu,
  Server,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useChat } from '@/hooks/use-chat';
import { useConversations, type ConversationListItem } from '@/hooks/use-conversations';
import { usePublishedAgents, type PublishedAgentItem } from '@/hooks/use-published-agents';
import { useEnabledModels, type EnabledModelGroup } from '@/hooks/use-providers';
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─── Helpers ────────────────────────────────────────────────

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('');
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

// ─── Skeleton ───────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <div className="space-y-3 px-2 py-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className="h-3.5 w-3.5 shrink-0 animate-pulse rounded bg-muted" />
          <div
            className="h-3 animate-pulse rounded bg-muted"
            style={{ width: `${55 + Math.random() * 35}%`, animationDelay: `${i * 75}ms` }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Chat Message ───────────────────────────────────────────

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

// ─── Conversation Context Menu ──────────────────────────────

function ConversationItemMenu({
  conversation,
  onRename,
  onArchive,
  onDelete,
  onExport,
  isArchiveView,
}: {
  conversation: ConversationListItem;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onExport: (format: 'json' | 'md') => void;
  isArchiveView: boolean;
}) {
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-popup-open:opacity-100"
        onClick={stop(() => {})}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={8}>
        {!isArchiveView && (
          <DropdownMenuItem onClick={stop(onRename)}>
            <PenLine className="h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={stop(onArchive)}>
          {isArchiveView ? (
            <><ArchiveRestore className="h-3.5 w-3.5" /> Unarchive</>
          ) : (
            <><Archive className="h-3.5 w-3.5" /> Archive</>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Export as</DropdownMenuLabel>
        <DropdownMenuItem onClick={stop(() => onExport('json'))}>
          <FileJson className="h-3.5 w-3.5" />
          JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={stop(() => onExport('md'))}>
          <FileText className="h-3.5 w-3.5" />
          Markdown
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={stop(onDelete)}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Conversation Sidebar ───────────────────────────────────

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onArchive,
  onExport,
  isLoading,
  showArchived,
  onToggleArchived,
}: {
  conversations: ConversationListItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onArchive: (id: string) => void;
  onExport: (id: string, format: 'json' | 'md') => void;
  isLoading: boolean;
  showArchived: boolean;
  onToggleArchived: () => void;
}) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }, []);

  const filtered = debouncedSearch
    ? conversations.filter(
        (c) =>
          c.title?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          c.agentName?.toLowerCase().includes(debouncedSearch.toLowerCase()),
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent py-1.5 pl-8 pr-8 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 pb-1">
        <button
          onClick={onToggleArchived}
          className={cn(
            'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
            showArchived
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Archive className="h-3 w-3" />
          {showArchived ? 'Showing archived' : 'Archived'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <SidebarSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12">
            {showArchived ? (
              <>
                <Archive className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-center text-xs text-muted-foreground">
                  No archived conversations
                </p>
              </>
            ) : search ? (
              <>
                <Search className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-center text-xs text-muted-foreground">
                  No matching conversations
                </p>
              </>
            ) : (
              <>
                <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-center text-xs text-muted-foreground">
                  No conversations yet
                </p>
                <p className="text-center text-[10px] text-muted-foreground/60">
                  Start a new chat to begin
                </p>
              </>
            )}
          </div>
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

                  <ConversationItemMenu
                    conversation={conv}
                    isArchiveView={showArchived}
                    onRename={() => {
                      setEditingId(conv.id);
                      setEditTitle(conv.title || '');
                    }}
                    onArchive={() => onArchive(conv.id)}
                    onDelete={() => onDelete(conv.id)}
                    onExport={(format) => onExport(conv.id, format)}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Agent & Model Picker ────────────────────────────────────

interface PickerSelection {
  type: 'default' | 'agent' | 'model';
  agentId?: string;
  modelId?: string;
  providerId?: string;
  label: string;
}

function AgentModelPicker({
  agents,
  modelGroups,
  selection,
  onSelect,
}: {
  agents: PublishedAgentItem[];
  modelGroups: EnabledModelGroup[];
  selection: PickerSelection;
  onSelect: (sel: PickerSelection) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
      >
        {selection.type === 'agent' ? (
          <Bot className="h-4 w-4 text-primary" />
        ) : selection.type === 'model' ? (
          <Cpu className="h-4 w-4 text-blue-500" />
        ) : (
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        )}
        <span className={cn('max-w-[240px] truncate', selection.type === 'default' ? 'text-muted-foreground' : 'font-medium')}>
          {selection.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-[70vh] w-80 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
            <button
              onClick={() => {
                onSelect({ type: 'default', label: 'Direct Chat' });
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                selection.type === 'default' && 'bg-accent',
              )}
            >
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <div className="text-left">
                <p className="font-medium">Direct Chat</p>
                <p className="text-xs text-muted-foreground">Default model</p>
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
                      onSelect({ type: 'agent', agentId: agent.id, label: agent.name });
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent',
                      selection.type === 'agent' && selection.agentId === agent.id && 'bg-accent',
                    )}
                  >
                    <Bot className="h-4 w-4 text-primary" />
                    <div className="min-w-0 text-left">
                      <p className="truncate font-medium">{agent.name}</p>
                      {agent.description && (
                        <p className="truncate text-xs text-muted-foreground">{agent.description}</p>
                      )}
                    </div>
                  </button>
                ))}
              </>
            )}

            {modelGroups.length > 0 && (
              <>
                <div className="my-1 border-t border-border" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Models
                </p>
                {modelGroups.map((group) => (
                  <div key={group.providerId}>
                    <div className="flex items-center gap-1.5 px-3 py-1">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {group.providerName}
                      </span>
                    </div>
                    {group.models.map((model) => (
                      <button
                        key={`${group.providerId}-${model.id}`}
                        onClick={() => {
                          onSelect({
                            type: 'model',
                            modelId: model.id,
                            providerId: group.providerId,
                            label: model.name,
                          });
                          setIsOpen(false);
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 pl-7 text-sm transition-colors hover:bg-accent',
                          selection.type === 'model' &&
                            selection.modelId === model.id &&
                            selection.providerId === group.providerId &&
                            'bg-accent',
                        )}
                      >
                        <Cpu className="h-3.5 w-3.5 text-blue-500" />
                        <div className="min-w-0 text-left">
                          <p className="truncate font-medium">{model.name}</p>
                          {model.contextWindow && (
                            <p className="text-[10px] text-muted-foreground">
                              {(model.contextWindow / 1000).toFixed(0)}K context
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Delete Confirmation Dialog ─────────────────────────────

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            This will remove the conversation from your list. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();

  const activeConversationId = searchParams.get('c');
  const initialAgentId = searchParams.get('agent');

  const [selection, setSelection] = useState<PickerSelection>(
    initialAgentId
      ? { type: 'agent', agentId: initialAgentId, label: '' }
      : { type: 'default', label: 'Direct Chat' },
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { agents } = usePublishedAgents();
  const { models: enabledModels, fetchModels } = useEnabledModels();
  const {
    conversations,
    isLoading: conversationsLoading,
    fetchConversations,
    deleteConversation,
    renameConversation,
    archiveConversation,
    unarchiveConversation,
    exportConversation,
  } = useConversations();

  useEffect(() => { fetchModels(); }, [fetchModels]);

  const handleConversationCreated = useCallback(
    (newId: string) => {
      router.replace(`/chat?c=${newId}`, { scroll: false });
      fetchConversations({ archived: showArchived });
    },
    [router, fetchConversations, showArchived],
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
    agentId: selection.type === 'agent' ? selection.agentId : undefined,
    modelId: selection.type === 'model' ? selection.modelId : undefined,
    providerId: selection.type === 'model' ? selection.providerId : undefined,
    conversationId: activeConversationId ?? undefined,
    onConversationCreated: handleConversationCreated,
  });

  useEffect(() => {
    fetchConversations({ archived: showArchived });
  }, [fetchConversations, showArchived]);

  const handleSelectConversation = useCallback(
    (id: string) => {
      router.push(`/chat?c=${id}`, { scroll: false });
    },
    [router],
  );

  const handleNewChat = useCallback(() => {
    clearMessages();
    setSelection({ type: 'default', label: 'Direct Chat' });
    router.push('/chat', { scroll: false });
  }, [clearMessages, router]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await deleteConversation(id);
      if (activeConversationId === id) handleNewChat();
    },
    [deleteConversation, activeConversationId, handleNewChat],
  );

  const handleArchiveConversation = useCallback(
    async (id: string) => {
      if (showArchived) {
        await unarchiveConversation(id);
      } else {
        await archiveConversation(id);
        if (activeConversationId === id) handleNewChat();
      }
    },
    [showArchived, archiveConversation, unarchiveConversation, activeConversationId, handleNewChat],
  );

  const handleExportConversation = useCallback(
    async (id: string, format: 'json' | 'md') => {
      try {
        await exportConversation(id, format);
      } catch {
        // Export error handled silently — the blob download will fail gracefully
      }
    },
    [exportConversation],
  );

  const handlePickerSelect = useCallback(
    (sel: PickerSelection) => {
      setSelection(sel);
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

  const handleToggleArchived = useCallback(() => {
    setShowArchived((prev) => !prev);
  }, []);

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
            onDelete={(id) => setDeleteTarget(id)}
            onRename={renameConversation}
            onArchive={handleArchiveConversation}
            onExport={handleExportConversation}
            isLoading={conversationsLoading}
            showArchived={showArchived}
            onToggleArchived={handleToggleArchived}
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
          <AgentModelPicker
            agents={agents}
            modelGroups={enabledModels}
            selection={selection}
            onSelect={handlePickerSelect}
          />
          <div className="flex-1" />
        </div>

        {isLoadingHistory ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-xs text-muted-foreground">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <ConversationEmptyState
            icon={<MessageSquare className="h-8 w-8" />}
            title="Start a conversation"
            description={
              selection.type !== 'default'
                ? `Chat with ${selection.label}`
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

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => {
          if (deleteTarget) handleDeleteConversation(deleteTarget);
        }}
      />
    </div>
  );
}
