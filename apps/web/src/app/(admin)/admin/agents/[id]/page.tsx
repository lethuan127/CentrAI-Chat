'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Bot,
  ArrowLeft,
  Pencil,
  Globe,
  GlobeLock,
  Archive,
  Trash2,
  Clock,
  User,
  Tag,
  Thermometer,
  Hash,
  History,
  MessageSquare,
  ToggleRight,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useAgents } from '@/hooks/use-agents';
import type { AgentListItem, AgentVersion } from '@/hooks/use-agents';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PUBLISHED: { label: 'Published', variant: 'default' },
  ARCHIVED: { label: 'Archived', variant: 'outline' },
};

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { getAgent, getVersions, publishAgent, unpublishAgent, archiveAgent, deleteAgent } = useAgents();
  const [agent, setAgent] = useState<AgentListItem | null>(null);
  const [versions, setVersions] = useState<AgentVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.id) return;
    setIsLoading(true);
    try {
      const [a, v] = await Promise.all([
        getAgent(params.id),
        getVersions(params.id),
      ]);
      setAgent(a);
      setVersions(v);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent');
    } finally {
      setIsLoading(false);
    }
  }, [params.id, getAgent, getVersions]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (action: string) => {
    if (!agent) return;
    setActionLoading(action);
    try {
      switch (action) {
        case 'publish':
          await publishAgent(agent.id);
          break;
        case 'unpublish':
          await unpublishAgent(agent.id);
          break;
        case 'archive':
          await archiveAgent(agent.id);
          break;
        case 'delete':
          if (!window.confirm(`Delete "${agent.name}"?`)) return;
          await deleteAgent(agent.id);
          router.push('/admin/agents');
          return;
      }
      await load();
    } catch {
      // hook handles error state
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <p className="text-destructive">{error || 'Agent not found'}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/agents')}>
          Back to Agents
        </Button>
      </div>
    );
  }

  const cfg = statusConfig[agent.status];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Back */}
      <button
        onClick={() => router.push('/admin/agents')}
        className="mb-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All Agents
      </button>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{agent.name}</h1>
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </div>
            {agent.description && (
              <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/admin/agents/${agent.id}/edit`)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          {agent.status === 'DRAFT' && (
            <Button onClick={() => handleAction('publish')} disabled={actionLoading === 'publish'}>
              {actionLoading === 'publish' ? <Spinner className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              Publish
            </Button>
          )}
          {agent.status === 'PUBLISHED' && (
            <Button variant="outline" onClick={() => handleAction('unpublish')} disabled={actionLoading === 'unpublish'}>
              {actionLoading === 'unpublish' ? <Spinner className="h-4 w-4" /> : <GlobeLock className="h-4 w-4" />}
              Unpublish
            </Button>
          )}
          {agent.status !== 'ARCHIVED' && (
            <Button variant="outline" onClick={() => handleAction('archive')} disabled={actionLoading === 'archive'}>
              {actionLoading === 'archive' ? <Spinner className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              Archive
            </Button>
          )}
          <Button variant="destructive" onClick={() => handleAction('delete')} disabled={actionLoading === 'delete'}>
            {actionLoading === 'delete' ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </div>

      <Separator className="my-6" />

      {/* Details Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Role */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-sm leading-relaxed">
                {agent.role}
              </pre>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-sm leading-relaxed">
                {agent.instructions}
              </pre>
            </CardContent>
          </Card>

          {/* Expected Output */}
          {agent.expectedOutput && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expected Output</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-mono text-sm leading-relaxed">
                  {agent.expectedOutput}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4" />
                Version History
              </CardTitle>
              <CardDescription>{versions.length} version{versions.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No version history available.</p>
              ) : (
                <div className="space-y-3">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start justify-between rounded-lg border border-border p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">v{v.version}</span>
                          {v.version === agent.version && (
                            <Badge variant="secondary" className="text-xs">Current</Badge>
                          )}
                        </div>
                        {v.changelog && (
                          <p className="mt-1 text-sm text-muted-foreground">{v.changelog}</p>
                        )}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div>{v.creator?.name || v.creator?.email}</div>
                        <div>{new Date(v.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <InfoRow icon={Hash} label="Version" value={`v${agent.version}`} />
              <InfoRow icon={Bot} label="Model" value={agent.modelId || 'Not set'} />
              <InfoRow icon={Bot} label="Provider" value={agent.modelProvider || 'Not set'} />
              <InfoRow icon={Thermometer} label="Temperature" value={agent.modelTemperature.toFixed(1)} />
              <InfoRow icon={Hash} label="Max Tokens" value={agent.modelMaxTokens?.toLocaleString() || 'Default'} />
              <InfoRow icon={ToggleRight} label="Session State" value={agent.addSessionStateToContext ? 'On' : 'Off'} />
              <InfoRow icon={MessageSquare} label="Turn History" value={agent.maxTurnsMessageHistory?.toString() || 'Unlimited'} />
              <InfoRow icon={ToggleRight} label="Summaries" value={agent.enableSessionSummaries ? 'On' : 'Off'} />
              <InfoRow icon={Wrench} label="Tools" value={Array.isArray(agent.tools) ? `${agent.tools.length} bound` : '0 bound'} />
              <InfoRow
                icon={User}
                label="Created By"
                value={agent.creator?.name || agent.creator?.email || 'Unknown'}
              />
              <InfoRow
                icon={Clock}
                label="Created"
                value={new Date(agent.createdAt).toLocaleDateString()}
              />
              <InfoRow
                icon={Clock}
                label="Updated"
                value={new Date(agent.updatedAt).toLocaleDateString()}
              />
            </CardContent>
          </Card>

          {agent.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {agent.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
