'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { useAgents } from '@/hooks/use-agents';
import type { AgentListItem } from '@/hooks/use-agents';

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

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 20) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        role: role.trim(),
        instructions: instructions.trim(),
        expectedOutput: expectedOutput.trim() || undefined,
        modelId: modelId.trim() || undefined,
        modelProvider: modelProvider.trim() || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Name <span className="text-destructive">*</span>
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Customer Support Agent"
          required
          maxLength={100}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of what this agent does"
          maxLength={500}
        />
      </div>

      {/* Role */}
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

      {/* Instructions */}
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

      {/* Expected Output */}
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

      {/* Model Settings */}
      <fieldset className="space-y-4 rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium">Model Configuration</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="modelId" className="text-sm font-medium">
              Model ID
            </label>
            <Input
              id="modelId"
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              placeholder="e.g. gpt-4o"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="modelProvider" className="text-sm font-medium">
              Provider
            </label>
            <Input
              id="modelProvider"
              value={modelProvider}
              onChange={(e) => setModelProvider(e.target.value)}
              placeholder="e.g. openai"
            />
            <p className="text-xs text-muted-foreground">
              Configure providers in Phase 5.
            </p>
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

      {/* Session Settings */}
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

      {/* Tags */}
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
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter' : ''}
            className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {tags.length}/20 tags. Press Enter or comma to add.
        </p>
      </div>

      {/* Changelog (edit only) */}
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

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/admin/agents')}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSaving || !name.trim() || !role.trim() || !instructions.trim()}>
          {isSaving && <Spinner className="h-4 w-4" />}
          {isEditing ? 'Save Changes' : 'Create Agent'}
        </Button>
      </div>
    </form>
  );
}
