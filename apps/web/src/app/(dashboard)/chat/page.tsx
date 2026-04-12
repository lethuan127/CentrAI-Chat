'use client';

import {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
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
  GitBranchPlus,
  Globe,
  Image as ImageLucide,
  Type,
  Crosshair,
  Mic,
  ArrowUp,
  Square,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useChat, type BranchGraphMessage } from '@/hooks/use-chat';
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
  MessageBranch,
  MessageBranchContent,
  MessageBranchSelector,
  MessageBranchPrevious,
  MessageBranchNext,
  MessageBranchPage,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { Spinner } from '@/components/ui/spinner';
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
import { Textarea } from '@/components/ui/textarea';

// ─── ChatGPT-style shell (light) ─────────────────────────────

const CG = {
  canvas: 'bg-white text-[#0d0d0d]',
  sidebarBg: 'bg-[#f9f9f9]',
  hairline: 'border-[#ececec]',
  userBubble: 'rounded-[1.35rem] bg-[#f4f4f4] text-[#0d0d0d]',
  muted: 'text-neutral-500',
  composerBorder: 'border-[#e5e5e5]',
} as const;

function ComposerIconButton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
    >
      {children}
    </button>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join('');
}

function graphMessageToUi(msg: BranchGraphMessage): UIMessage {
  return {
    id: msg.id,
    role: msg.role.toLowerCase() as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: msg.content }],
  } as UIMessage;
}

function assistantSiblingsForParent(
  graph: BranchGraphMessage[],
  userParentId: string | null | undefined,
): BranchGraphMessage[] {
  if (!userParentId) return [];
  return graph
    .filter((m) => m.role === 'ASSISTANT' && m.parentId === userParentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

function ChatMessageItem({
  message,
  isStreaming,
  modelLabel,
  showBranchAction,
  onBranch,
}: {
  message: UIMessage;
  isStreaming: boolean;
  modelLabel?: string | null;
  showBranchAction?: boolean;
  onBranch?: () => void;
}) {
  const text = getMessageText(message);
  const isAssistantStreaming = isStreaming && message.role === 'assistant';

  const isAssistant = message.role === 'assistant';

  return (
    <Message
      from={message.role}
      className={cn(isAssistant ? 'w-full max-w-3xl' : 'max-w-[min(85%,34rem)]')}
    >
      {isAssistant && (modelLabel || showBranchAction) ? (
        <div className={cn('flex flex-wrap items-center gap-2 text-[12px] font-normal tracking-wide', CG.muted)}>
          <span>{modelLabel ?? 'Assistant'}</span>
          {showBranchAction && onBranch ? (
            <button
              type="button"
              title="Branch — alternate reply from here"
              onClick={onBranch}
              className="cursor-pointer rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              <GitBranchPlus className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      <MessageContent
        className={cn(
          isAssistant &&
            '!rounded-none !border-0 !bg-transparent !p-0 !px-0 !py-0 !shadow-none',
        )}
      >
        {message.role === 'user' ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : text ? (
          <MessageResponse
            isAnimating={isAssistantStreaming}
            className={cn(
              'text-[15px] leading-7 text-[#0d0d0d] [&>*:first-child]:mt-0',
              '[&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[#0d0d0d]',
              '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-2 [&_h3]:text-base [&_h3]:font-semibold',
              '[&_h3]:before:inline-block [&_h3]:before:h-2 [&_h3]:before:w-2 [&_h3]:before:rotate-45 [&_h3]:before:bg-[#2e6efb]',
              '[&_pre]:my-4 [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-neutral-200 [&_pre]:bg-[#f7f7f8] [&_pre]:p-4',
              '[&_code]:text-[13px] [&_li]:my-1 [&_strong]:font-semibold',
            )}
          >
            {text}
          </MessageResponse>
        ) : isAssistantStreaming ? (
          <span className={cn('text-sm', CG.muted)}>
            <Shimmer duration={1}>Thinking...</Shimmer>
          </span>
        ) : null}
      </MessageContent>
    </Message>
  );
}

function UserMessageRow({
  message,
  allowEdit,
  onEditSave,
}: {
  message: UIMessage;
  allowEdit: boolean;
  onEditSave: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const text = getMessageText(message);

  useLayoutEffect(() => {
    if (!editing) return;
    const el = editTextareaRef.current;
    if (!el) return;
    const len = el.value.length;
    el.focus();
    el.setSelectionRange(len, len);
  }, [editing]);

  const startEdit = () => {
    setDraft(text);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setDraft('');
  };

  const save = async () => {
    const t = draft.trim();
    if (!t) return;
    setSaving(true);
    try {
      await onEditSave(t);
      setEditing(false);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Message from="user" className="max-w-[min(85%,34rem)]">
      <div className="group/usermsg flex w-full flex-row items-start justify-end gap-1">
        {editing ? (
          <div
            className={cn(
              'flex w-full min-w-0 flex-col gap-2 rounded-3xl border px-4 py-3',
              CG.composerBorder,
              'bg-white shadow-sm',
            )}
          >
            <Textarea
              ref={editTextareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="min-h-[88px] resize-y border-0 bg-transparent text-[15px] text-[#0d0d0d] shadow-none focus-visible:ring-0"
              disabled={saving}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={cancel} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-full bg-[#10a37f] text-white hover:bg-[#0d8f6e] disabled:opacity-50"
                onClick={() => void save()}
                disabled={saving || !draft.trim()}
              >
                Save & branch
              </Button>
            </div>
          </div>
        ) : (
          <>
            <MessageContent className="!border-0 !shadow-none">
              <p className="whitespace-pre-wrap">{text}</p>
            </MessageContent>
            {allowEdit ? (
              <button
                type="button"
                title="Edit message"
                onClick={startEdit}
                className="mt-1 shrink-0 cursor-pointer rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity group-hover/usermsg:opacity-100 hover:bg-neutral-100 hover:text-neutral-700"
              >
                <PenLine className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </>
        )}
      </div>
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
      <div className={cn('flex items-center gap-2 border-b px-3 py-3', CG.hairline)}>
        <button
          onClick={onNew}
          className={cn(
            'flex flex-1 cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-2 text-sm font-medium text-[#0d0d0d] transition-colors',
            CG.composerBorder,
            'shadow-sm hover:bg-neutral-50',
          )}
        >
          <Plus className="h-4 w-4 text-neutral-600" />
          New Chat
        </button>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className={cn('absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2', CG.muted)} />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(
              'w-full rounded-full border bg-white py-2 pl-8 pr-8 text-xs text-[#0d0d0d] placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300',
              CG.composerBorder,
            )}
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); }}
              className={cn('absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer hover:text-[#0d0d0d]', CG.muted)}
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
            'flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium transition-colors',
            showArchived
              ? 'bg-white text-[#2e6efb] shadow-sm ring-1 ring-neutral-200/80'
              : cn(CG.muted, 'hover:bg-black/[0.04] hover:text-[#0d0d0d]'),
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
                <Archive className="h-8 w-8 text-neutral-300" />
                <p className={cn('text-center text-xs', CG.muted)}>No archived conversations</p>
              </>
            ) : search ? (
              <>
                <Search className="h-8 w-8 text-neutral-300" />
                <p className={cn('text-center text-xs', CG.muted)}>No matching conversations</p>
              </>
            ) : (
              <>
                <MessageSquare className="h-8 w-8 text-neutral-300" />
                <p className={cn('text-center text-xs', CG.muted)}>No conversations yet</p>
                <p className="text-center text-[10px] text-neutral-400">Start a new chat to begin</p>
              </>
            )}
          </div>
        ) : (
          Object.entries(grouped).map(([label, items]) => (
            <div key={label} className="mb-2">
              <p className={cn('px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider', CG.muted)}>
                {label}
              </p>
              {items.map((conv) => (
                <div
                  key={conv.id}
                  className={cn(
                    'group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    conv.id === activeId
                      ? 'bg-white text-[#0d0d0d] shadow-sm ring-1 ring-neutral-200/80'
                      : 'text-[#0d0d0d] hover:bg-black/[0.04]',
                  )}
                  onClick={() => onSelect(conv.id)}
                >
                  {conv.agentName ? (
                    <Bot className={cn('h-3.5 w-3.5 shrink-0', CG.muted)} />
                  ) : (
                    <MessageSquare className={cn('h-3.5 w-3.5 shrink-0', CG.muted)} />
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
  /** Full model ref from the API, e.g. openai/gpt-4o-mini */
  modelId?: string;
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
        type="button"
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-sm transition-colors',
          CG.composerBorder,
          'bg-white text-[#0d0d0d] shadow-sm hover:bg-neutral-50',
        )}
      >
        {selection.type === 'agent' ? (
          <Bot className="h-4 w-4 text-[#2e6efb]" />
        ) : selection.type === 'model' ? (
          <Cpu className="h-4 w-4 text-[#2e6efb]" />
        ) : (
          <MessageSquare className="h-4 w-4 text-neutral-500" />
        )}
        <span
          className={cn(
            'max-w-[220px] truncate',
            selection.type === 'default' ? 'text-neutral-500' : 'font-medium',
          )}
        >
          {selection.label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
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
                  <div key={group.backendKey}>
                    <div className="flex items-center gap-1.5 px-3 py-1">
                      <Server className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {group.backendName}
                      </span>
                    </div>
                    {group.models.map((model) => (
                      <button
                        key={`${group.backendKey}-${model.id}`}
                        onClick={() => {
                          onSelect({
                            type: 'model',
                            modelId: model.id,
                            label: model.name,
                          });
                          setIsOpen(false);
                        }}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 pl-7 text-sm transition-colors hover:bg-accent',
                          selection.type === 'model' &&
                            selection.modelId === model.id &&
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
    branchGraph,
    conversationMeta,
    conversationId: chatConversationId,
    regenerateAssistantBranch,
    switchActiveBranch,
    editUserMessageAndRegenerate,
  } = useChat({
    agentId: selection.type === 'agent' ? selection.agentId : undefined,
    modelId: selection.type === 'model' ? selection.modelId : undefined,
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

  const assistantHeaderLabel =
    conversationMeta.agentName ??
    (conversationMeta.modelId ? conversationMeta.modelId : null) ??
    (selection.type === 'model'
      ? selection.label
      : selection.type === 'agent'
        ? selection.label
        : 'Assistant');

  return (
    <div className={cn('flex h-full', CG.canvas)}>
      <aside
        className={cn(
          'flex h-full flex-col border-r transition-all duration-200',
          CG.sidebarBg,
          CG.hairline,
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0',
        )}
      >
        <div className={cn('flex h-12 items-center justify-between border-b px-4', CG.hairline)}>
          <Link href="/chat" className="text-[15px] font-semibold tracking-tight text-[#0d0d0d]">
            CentrAI
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-[#0d0d0d]"
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

        <div className={cn('space-y-0.5 border-t px-2 py-2', CG.hairline)}>
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-[#0d0d0d]"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </Link>
          {isAdminOrDev && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-black/[0.04] hover:text-[#0d0d0d]"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin Panel
            </Link>
          )}
          <div className="flex items-center gap-3 px-3 py-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200/80 text-[10px] font-medium text-neutral-700">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
            </div>
            <span className="flex-1 truncate text-xs font-medium text-[#0d0d0d]">
              {user?.name || user?.email}
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                router.push('/login');
              }}
              className="cursor-pointer rounded p-1 text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-[#0d0d0d]"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className={cn('flex flex-1 flex-col', CG.canvas)}>
        <div className={cn('flex h-12 items-center gap-3 border-b px-4', CG.hairline)}>
          {!sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="cursor-pointer rounded-md p-1.5 text-neutral-500 transition-colors hover:bg-black/[0.04] hover:text-[#0d0d0d]"
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
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-[#0d0d0d]" />
            <p className={cn('text-xs', CG.muted)}>Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <ConversationEmptyState
            icon={<MessageSquare className="h-9 w-9 text-neutral-300" />}
            title="Start a conversation"
            description={
              selection.type !== 'default'
                ? `Chat with ${selection.label}`
                : 'Type a message below to begin chatting.'
            }
            className={cn('flex-1', CG.muted)}
          />
        ) : (
          <Conversation className="flex-1 bg-white">
            <ConversationContent className="mx-auto max-w-3xl gap-7 px-4 pb-28 pt-6 md:px-6">
              {messages.map((msg, idx) => {
                if (msg.role === 'user') {
                  return (
                    <UserMessageRow
                      key={msg.id}
                      message={msg}
                      allowEdit={!!chatConversationId && status === 'ready'}
                      onEditSave={(text) => editUserMessageAndRegenerate(msg.id, text)}
                    />
                  );
                }

                const graphRow = branchGraph.find((g) => g.id === msg.id);
                const parentUserId = graphRow?.parentId;
                const siblings = assistantSiblingsForParent(branchGraph, parentUserId);
                const streamingHere = isLastAssistantStreaming && idx === messages.length - 1;

                if (siblings.length <= 1) {
                  return (
                    <ChatMessageItem
                      key={msg.id}
                      message={msg}
                      isStreaming={streamingHere}
                      modelLabel={assistantHeaderLabel}
                      showBranchAction={!streamingHere && !!chatConversationId}
                      onBranch={
                        chatConversationId ? () => regenerateAssistantBranch(msg.id) : undefined
                      }
                    />
                  );
                }

                const defaultBranch = Math.max(0, siblings.findIndex((s) => s.id === msg.id));

                return (
                  <MessageBranch
                    key={`branch-${parentUserId}-${msg.id}`}
                    className="w-full max-w-3xl"
                    defaultBranch={defaultBranch}
                    onBranchChange={(bi) => {
                      const target = siblings[bi];
                      if (target && target.id !== msg.id) {
                        void switchActiveBranch(target.id);
                      }
                    }}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <MessageBranchSelector className="rounded-full border border-neutral-200/80 bg-white px-0.5 shadow-sm">
                        <MessageBranchPrevious />
                        <MessageBranchPage />
                        <MessageBranchNext />
                      </MessageBranchSelector>
                      <span className={cn('text-[12px] font-normal', CG.muted)}>{assistantHeaderLabel}</span>
                    </div>
                    <MessageBranchContent>
                      {siblings.map((s) => (
                        <div key={s.id}>
                          <ChatMessageItem
                            message={graphMessageToUi(s)}
                            isStreaming={false}
                            modelLabel={assistantHeaderLabel}
                            showBranchAction={!!chatConversationId}
                            onBranch={
                              chatConversationId
                                ? () => regenerateAssistantBranch(s.id)
                                : undefined
                            }
                          />
                        </div>
                      ))}
                    </MessageBranchContent>
                  </MessageBranch>
                );
              })}
            </ConversationContent>
            <ConversationScrollButton className="bottom-28 h-9 w-9 border-neutral-200 bg-white text-neutral-600 shadow-md hover:bg-neutral-50" />
          </Conversation>
        )}

        {error && (
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-2 text-sm text-red-600">
            <span>{error.message}</span>
          </div>
        )}

        <div className={cn('border-t px-4 pb-6 pt-3', CG.hairline, 'bg-white')}>
          <div className="mx-auto max-w-3xl">
            <div
              className={cn(
                'rounded-[28px] border bg-white p-2',
                CG.composerBorder,
                'shadow-[0_6px_24px_rgba(0,0,0,0.06)] transition-shadow focus-within:border-neutral-300 focus-within:shadow-[0_8px_28px_rgba(0,0,0,0.08)]',
              )}
            >
              <PromptInput
                onSubmit={handlePromptSubmit}
                inputGroupClassName={cn(
                  'rounded-[22px] border-0 bg-transparent shadow-none ring-0',
                  'has-[[data-slot=input-group-control]:focus-visible]:ring-0',
                )}
              >
                <PromptInputTextarea
                  placeholder="Ask anything"
                  className="min-h-[52px] max-h-52 border-0 bg-transparent px-3 py-3 text-[15px] text-[#0d0d0d] shadow-none placeholder:text-neutral-400 focus-visible:ring-0"
                />
                <PromptInputFooter className="items-center border-t-0 px-1 pb-1 pt-0">
                  <PromptInputTools className="flex-wrap gap-0.5 pl-0.5">
                    <ComposerIconButton title="Add (coming soon)">
                      <Plus className="h-4 w-4" />
                    </ComposerIconButton>
                    <ComposerIconButton title="Search (coming soon)">
                      <Globe className="h-4 w-4" />
                    </ComposerIconButton>
                    <ComposerIconButton title="Attach (coming soon)">
                      <ImageLucide className="h-4 w-4" />
                    </ComposerIconButton>
                    <ComposerIconButton title="Style (coming soon)">
                      <Type className="h-4 w-4" />
                    </ComposerIconButton>
                    <button
                      type="button"
                      title="Mode (coming soon)"
                      className="rounded-full px-2.5 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100"
                    >
                      Auto
                    </button>
                  </PromptInputTools>
                  <div className="flex items-center gap-0.5 pr-0.5">
                    <ComposerIconButton title="Tools (coming soon)">
                      <Crosshair className="h-4 w-4" />
                    </ComposerIconButton>
                    <ComposerIconButton title="Voice (coming soon)">
                      <Mic className="h-4 w-4" />
                    </ComposerIconButton>
                    <PromptInputSubmit
                      variant="ghost"
                      status={status}
                      onStop={stop}
                      className={cn(
                        'ms-1 size-9 shrink-0 rounded-full shadow-none',
                        status === 'ready' &&
                          'bg-[#0d0d0d] text-white hover:bg-[#303030] disabled:bg-neutral-200 disabled:text-neutral-400 disabled:hover:bg-neutral-200',
                        (status === 'submitted' || status === 'streaming') &&
                          'bg-transparent text-neutral-700 hover:bg-neutral-100',
                      )}
                    >
                      {status === 'ready' ? (
                        <ArrowUp className="size-4 stroke-[2.5]" />
                      ) : status === 'submitted' ? (
                        <Spinner className="size-4" />
                      ) : status === 'streaming' ? (
                        <Square className="size-3.5 fill-current" />
                      ) : status === 'error' ? (
                        <X className="size-4" />
                      ) : (
                        <ArrowUp className="size-4 stroke-[2.5]" />
                      )}
                    </PromptInputSubmit>
                  </div>
                </PromptInputFooter>
              </PromptInput>
            </div>
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
