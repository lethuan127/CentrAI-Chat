'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { LLM_BACKEND_LABELS, LLM_MODEL_CATALOG, type ProviderTypeKey } from '@centrai/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/hooks/use-agents';
import type { AgentListItem } from '@/hooks/use-agents';

const BACKEND_ORDER: ProviderTypeKey[] = ['openai', 'anthropic', 'google', 'ollama', 'custom'];

/** Legacy DB/API uppercase → canonical lowercase backend key. */
const LEGACY_BACKEND_UPPER: Record<string, ProviderTypeKey> = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  OLLAMA: 'ollama',
  CUSTOM: 'custom',
};

function normalizeBackendKey(raw: string): ProviderTypeKey | null {
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if ((BACKEND_ORDER as readonly string[]).includes(lower)) return lower as ProviderTypeKey;
  return LEGACY_BACKEND_UPPER[t] ?? LEGACY_BACKEND_UPPER[t.toUpperCase()] ?? null;
}

interface AgentFormProps {
  agent?: AgentListItem;
}

export function AgentForm({ agent }: AgentFormProps) {
  const router = useRouter();
  const { createAgent, updateAgent } = useAgents();
  const isEditing = !!agent;

  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [role, setRole] = useState(agent?.role ?? '');
  const [instructions, setInstructions] = useState(agent?.instructions ?? '');
  const [expectedOutput, setExpectedOutput] = useState(agent?.expectedOutput ?? '');
  const [modelId, setModelId] = useState(agent?.modelId ?? '');
  const [modelProvider, setModelProvider] = useState(agent?.modelProvider ?? '');
  const [modelTemperature, setModelTemperature] = useState(agent?.modelTemperature ?? 0.7);
  const [modelMaxTokens, setModelMaxTokens] = useState<string>(agent?.modelMaxTokens?.toString() ?? '');
  const [addSessionStateToContext, setAddSessionStateToContext] = useState(agent?.addSessionStateToContext ?? false);
  const [maxTurnsMessageHistory, setMaxTurnMessageHistory] = useState<string>(agent?.maxTurnsMessageHistory?.toString() ?? '');
  const [enableSessionSummaries, setEnableSessionSummaries] = useState(agent?.enableSessionSummaries ?? false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(agent?.tags ?? []);
  const [changelog, setChangelog] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backendKey = useMemo(() => normalizeBackendKey(modelProvider), [modelProvider]);

  const modelOptions = useMemo(() => {
    if (!backendKey) return [];
    const list = LLM_MODEL_CATALOG[backendKey] ?? [];
    if (modelId && !list.some((m) => m.id === modelId)) {
      return [{ id: modelId, name: modelId, contextWindow: null, capabilities: {} }, ...list];
    }
    return list;
  }, [backendKey, modelId]);

  const unrecognizedBackend =
    Boolean(modelProvider.trim()) && modelProvider.trim().length > 0 && !backendKey;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const trimmedProv = modelProvider.trim();
      const modelProviderPayload = trimmedProv
        ? backendKey ?? trimmedProv
        : undefined;

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        role: role.trim(),
        instructions: instructions.trim(),
        expectedOutput: expectedOutput.trim() || undefined,
        modelId: modelId.trim() || undefined,
        modelProvider: modelProviderPayload,
        modelTemperature,
        modelMaxTokens: modelMaxTokens ? parseInt(modelMaxTokens, 10) : undefined,
        addSessionStateToContext,
        maxTurnsMessageHistory: maxTurnsMessageHistory ? parseInt(maxTurnsMessageHistory, 10) : undefined,
        enableSessionSummaries,
        tags,
      };

      if (isEditing && agent) {
        await updateAgent(agent.id, {
          ...payload,
          changelog: changelog.trim() || undefined,
        });
        router.push(`/admin/agents/${agent.id}`);
      } else {
        const created = await createAgent(payload);
        router.push(`/admin/agents/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-8">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Support Bot"
          required
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short summary for the agent directory"
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="role" className="text-sm font-medium">
          Role <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. You are a senior customer support specialist for an e-commerce platform."
          required
          rows={3}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          The persona or identity the agent adopts. {role.length.toLocaleString()} / 10,000 characters
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="instructions" className="text-sm font-medium">
          Instructions <span className="text-destructive">*</span>
        </label>
        <Textarea
          id="instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Respond politely and concisely. Always check order status before suggesting a refund..."
          required
          rows={8}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Detailed behavioral guidelines for the agent. {instructions.length.toLocaleString()} / 50,000 characters
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="expectedOutput" className="text-sm font-medium">
          Expected Output
        </label>
        <Textarea
          id="expectedOutput"
          value={expectedOutput}
          onChange={(e) => setExpectedOutput(e.target.value)}
          placeholder="Describe the format or structure of the agent's ideal response..."
          rows={3}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Guides the agent toward a specific response format or structure.
        </p>
      </div>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">Model Configuration</legend>

        {unrecognizedBackend && (
          <p className="text-sm text-amber-700 dark:text-amber-500">
            Saved backend{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{modelProvider.trim()}</code> is not
            recognized. Use{' '}
            <code className="font-mono text-xs">openai</code>, <code className="font-mono text-xs">anthropic</code>,{' '}
            <code className="font-mono text-xs">google</code>, <code className="font-mono text-xs">ollama</code>, or{' '}
            <code className="font-mono text-xs">custom</code>.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium" id="backend-select-label">
              LLM backend
            </span>
            <Select
              value={backendKey ?? ''}
              onValueChange={(next) => {
                setModelProvider(typeof next === 'string' ? next : '');
                setModelId('');
              }}
            >
              <SelectTrigger className="h-9 w-full max-w-full" aria-labelledby="backend-select-label">
                <SelectValue placeholder="Choose backend (API keys in server env)" />
              </SelectTrigger>
              <SelectContent className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]" alignItemWithTrigger={false}>
                <SelectItem value="">
                  <span className="text-muted-foreground">None (use chat default)</span>
                </SelectItem>
                {BACKEND_ORDER.map((key) => (
                  <SelectItem key={key} value={key}>
                    {LLM_BACKEND_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Credentials are configured on the API server (see{' '}
              <Link href="/admin/providers" className="underline underline-offset-2 hover:text-foreground">
                LLM setup
              </Link>
              ).
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <span className="text-sm font-medium" id="model-select-label">
              Model
            </span>
            {!backendKey ? (
              <p className="text-sm text-muted-foreground">Select a backend first, or leave both empty for the default model.</p>
            ) : modelOptions.length > 0 ? (
              <Select
                value={modelId || ''}
                onValueChange={(next) => setModelId(typeof next === 'string' ? next : '')}
              >
                <SelectTrigger className="h-9 w-full max-w-full" aria-labelledby="model-select-label">
                  <SelectValue placeholder="Choose a model" />
                </SelectTrigger>
                <SelectContent
                  className="w-[var(--anchor-width)] min-w-[var(--anchor-width)]"
                  alignItemWithTrigger={false}
                >
                  <SelectItem value="">
                    <span className="text-muted-foreground">None</span>
                  </SelectItem>
                  {modelOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                      <span className="text-muted-foreground"> ({m.id})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  No curated list for this backend (e.g. Ollama). Enter the model id your server exposes.
                </p>
                <Input
                  id="modelIdFree"
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder="e.g. llama3.2"
                  aria-labelledby="model-select-label"
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="modelTemperature" className="text-sm font-medium">
              Temperature
            </label>
            <div className="flex items-center gap-3">
              <input
                id="modelTemperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={modelTemperature}
                onChange={(e) => setModelTemperature(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-right text-sm tabular-nums">{modelTemperature.toFixed(1)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="modelMaxTokens" className="text-sm font-medium">
              Max Tokens
            </label>
            <Input
              id="modelMaxTokens"
              type="number"
              value={modelMaxTokens}
              onChange={(e) => setModelMaxTokens(e.target.value)}
              placeholder="Default"
              min={1}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">Session &amp; Context</legend>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Add session state to context</p>
            <p className="text-xs text-muted-foreground">Include session state variables in the prompt context.</p>
          </div>
          <Switch checked={addSessionStateToContext} onCheckedChange={setAddSessionStateToContext} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable session summaries</p>
            <p className="text-xs text-muted-foreground">Summarize long conversations to stay within context limits.</p>
          </div>
          <Switch checked={enableSessionSummaries} onCheckedChange={setEnableSessionSummaries} />
        </div>

        <div className="space-y-2">
          <label htmlFor="maxTurnsMessageHistory" className="text-sm font-medium">
            Max turn message history
          </label>
          <Input
            id="maxTurnsMessageHistory"
            type="number"
            value={maxTurnsMessageHistory}
            onChange={(e) => setMaxTurnMessageHistory(e.target.value)}
            placeholder="Unlimited"
            min={1}
          />
          <p className="text-xs text-muted-foreground">
            Limit how many previous turns are included in the prompt context.
          </p>
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="tagInput" className="text-sm font-medium">
          Tags
        </label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input p-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <input
            id="tagInput"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => {
              if (tagInput.trim()) addTag(tagInput);
            }}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter' : ''}
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {tags.length}/20 tags. Press Enter or comma to add.
        </p>
      </div>

      {isEditing && (
        <div className="space-y-2">
          <label htmlFor="changelog" className="text-sm font-medium">
            Changelog
          </label>
          <Input
            id="changelog"
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="What changed in this version?"
            maxLength={500}
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/agents')}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || !name.trim() || !role.trim() || !instructions.trim()}>
          {isSaving && <Spinner className="h-4 w-4" />}
          {isEditing ? 'Save Changes' : 'Create Agent'}
        </Button>
      </div>
    </form>
  );

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 20) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }
}
