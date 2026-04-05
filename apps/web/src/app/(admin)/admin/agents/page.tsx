'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Globe,
  Archive,
  GlobeLock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useAgents } from '@/hooks/use-agents';
import type { AgentListItem } from '@/hooks/use-agents';
import { cn } from '@/lib/utils';

type StatusFilter = 'ALL' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PUBLISHED: { label: 'Published', variant: 'default' },
  ARCHIVED: { label: 'Archived', variant: 'outline' },
};

export default function AgentsPage() {
  const router = useRouter();
  const { agents, meta, isLoading, error, fetchAgents, publishAgent, unpublishAgent, archiveAgent, deleteAgent } = useAgents();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchAgents({
      search: debouncedSearch || undefined,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    });
  }, [fetchAgents, debouncedSearch, statusFilter]);

  const handleAction = useCallback(async (action: string, agent: AgentListItem) => {
    try {
      switch (action) {
        case 'view':
          router.push(`/admin/agents/${agent.id}`);
          break;
        case 'edit':
          router.push(`/admin/agents/${agent.id}/edit`);
          break;
        case 'publish':
          await publishAgent(agent.id);
          fetchAgents({ search: debouncedSearch || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter });
          break;
        case 'unpublish':
          await unpublishAgent(agent.id);
          fetchAgents({ search: debouncedSearch || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter });
          break;
        case 'archive':
          await archiveAgent(agent.id);
          fetchAgents({ search: debouncedSearch || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter });
          break;
        case 'delete':
          if (window.confirm(`Delete "${agent.name}"? This can be recovered by an admin.`)) {
            await deleteAgent(agent.id);
            fetchAgents({ search: debouncedSearch || undefined, status: statusFilter === 'ALL' ? undefined : statusFilter });
          }
          break;
      }
    } catch {
      // errors surface via the hook
    }
  }, [router, publishAgent, unpublishAgent, archiveAgent, deleteAgent, fetchAgents, debouncedSearch, statusFilter]);

  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PUBLISHED', label: 'Published' },
    { value: 'ARCHIVED', label: 'Archived' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Agents</h1>
          {meta && (
            <span className="text-sm text-muted-foreground">({meta.total})</span>
          )}
        </div>
        <Button onClick={() => router.push('/admin/agents/new')}>
          <Plus className="h-4 w-4" />
          New Agent
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="mt-16 flex flex-col items-center justify-center">
          <Spinner className="h-8 w-8" />
          <p className="mt-4 text-muted-foreground">Loading agents...</p>
        </div>
      ) : error ? (
        <div className="mt-16 flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/50 py-16">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => fetchAgents()}>
            Retry
          </Button>
        </div>
      ) : agents.length === 0 ? (
        <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <Bot className="h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            {debouncedSearch || statusFilter !== 'ALL'
              ? 'No agents match your filters.'
              : 'No agents yet. Create your first agent to get started.'}
          </p>
          {!debouncedSearch && statusFilter === 'ALL' && (
            <Button className="mt-4" onClick={() => router.push('/admin/agents/new')}>
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onAction={handleAction}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() =>
              fetchAgents({
                search: debouncedSearch || undefined,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                page: meta.page - 1,
              })
            }
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() =>
              fetchAgents({
                search: debouncedSearch || undefined,
                status: statusFilter === 'ALL' ? undefined : statusFilter,
                page: meta.page + 1,
              })
            }
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  onAction,
}: {
  agent: AgentListItem;
  onAction: (action: string, agent: AgentListItem) => void;
}) {
  const cfg = statusConfig[agent.status];

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => onAction('view', agent)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="truncate">{agent.name}</CardTitle>
        </div>
        <CardAction>
          <div className="flex items-center gap-2">
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={(e) => e.stopPropagation()}
                className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onAction('view', agent)}>
                  <Eye className="h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onAction('edit', agent)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {agent.status === 'DRAFT' && (
                  <DropdownMenuItem onClick={() => onAction('publish', agent)}>
                    <Globe className="h-4 w-4" />
                    Publish
                  </DropdownMenuItem>
                )}
                {agent.status === 'PUBLISHED' && (
                  <DropdownMenuItem onClick={() => onAction('unpublish', agent)}>
                    <GlobeLock className="h-4 w-4" />
                    Unpublish
                  </DropdownMenuItem>
                )}
                {agent.status !== 'ARCHIVED' && (
                  <DropdownMenuItem onClick={() => onAction('archive', agent)}>
                    <Archive className="h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onAction('delete', agent)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardAction>
        <CardDescription className="line-clamp-2">
          {agent.description || 'No description'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {agent.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {agent.tags.length > 5 && (
              <Badge variant="outline" className="text-xs">
                +{agent.tags.length - 5}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-center justify-between text-xs text-muted-foreground">
          <span>v{agent.version}</span>
          <span>by {agent.creator?.name || agent.creator?.email || 'Unknown'}</span>
          <span>{new Date(agent.updatedAt).toLocaleDateString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
