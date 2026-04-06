'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Server,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProviders, type ProviderItem } from '@/hooks/use-providers';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

const PROVIDER_TYPES = [
  { value: 'OPENAI', label: 'OpenAI', description: 'GPT-4o, GPT-4, o1, o3 series', color: 'text-green-600' },
  { value: 'ANTHROPIC', label: 'Anthropic', description: 'Claude 4, 3.5 Sonnet, Haiku', color: 'text-orange-600' },
  { value: 'GOOGLE', label: 'Google Gemini', description: 'Gemini Pro, Flash, Ultra', color: 'text-blue-600' },
  { value: 'OLLAMA', label: 'Ollama', description: 'Local models (Llama, Mistral, Phi)', color: 'text-purple-600' },
  { value: 'CUSTOM', label: 'Custom (OpenAI-compatible)', description: 'vLLM, LiteLLM, Together, etc.', color: 'text-gray-600' },
];

function ProviderIcon({ type, className }: { type: string; className?: string }) {
  const meta = PROVIDER_TYPES.find((t) => t.value === type);
  return <Server className={cn('h-5 w-5', meta?.color ?? 'text-muted-foreground', className)} />;
}

function AddProviderDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; type: string; baseUrl?: string; apiKey?: string }) => Promise<void>;
}) {
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [providerName, setProviderName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep('type');
    setSelectedType(null);
    setProviderName('');
    setApiKey('');
    setBaseUrl('');
    setShowKey(false);
    setIsSubmitting(false);
  }, []);

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    const meta = PROVIDER_TYPES.find((t) => t.value === type);
    setProviderName(meta?.label ?? type);

    if (type === 'OLLAMA') setBaseUrl('http://localhost:11434');
    else if (type === 'OPENAI') setBaseUrl('');
    else setBaseUrl('');

    setStep('config');
  };

  const handleSubmit = async () => {
    if (!selectedType || !providerName.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: providerName.trim(),
        type: selectedType,
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
      });
      reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const needsApiKey = selectedType !== 'OLLAMA';
  const needsBaseUrl = selectedType === 'OLLAMA' || selectedType === 'CUSTOM';

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {step === 'type' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add Provider</DialogTitle>
              <DialogDescription>Choose the LLM provider type to configure.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {PROVIDER_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  onClick={() => handleSelectType(pt.value)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-accent"
                >
                  <ProviderIcon type={pt.value} />
                  <div>
                    <p className="text-sm font-medium">{pt.label}</p>
                    <p className="text-xs text-muted-foreground">{pt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Configure {PROVIDER_TYPES.find((t) => t.value === selectedType)?.label}</DialogTitle>
              <DialogDescription>Enter the connection details for this provider.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Display Name</label>
                <input
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {needsApiKey && (
                <div>
                  <label className="mb-1 block text-xs font-medium">API Key</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={selectedType === 'OPENAI' ? 'sk-...' : 'Enter API key'}
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">Encrypted at rest with AES-256-GCM.</p>
                </div>
              )}

              {needsBaseUrl && (
                <div>
                  <label className="mb-1 block text-xs font-medium">
                    Base URL {selectedType !== 'OLLAMA' && selectedType !== 'CUSTOM' && '(optional)'}
                  </label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={selectedType === 'OLLAMA' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                    className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('type')}>Back</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !providerName.trim()}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Provider'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProviderCard({
  provider,
  onTest,
  onSync,
  onDelete,
  onToggle,
  onToggleModel,
}: {
  provider: ProviderItem;
  onTest: () => void;
  onSync: () => void;
  onDelete: () => void;
  onToggle: (enabled: boolean) => void;
  onToggleModel: (modelId: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await (async () => { onTest(); return null; })();
      void result;
    } finally {
      setTesting(false);
    }
  };

  const meta = PROVIDER_TYPES.find((t) => t.value === provider.type);

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-4 p-4">
        <ProviderIcon type={provider.type} className="h-8 w-8" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{provider.name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {meta?.label ?? provider.type}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {provider.enabledModelCount} of {provider.totalModelCount} models enabled
            {provider.hasApiKey && ' · API key configured'}
            {provider.baseUrl && ` · ${provider.baseUrl}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={provider.isEnabled}
            onCheckedChange={onToggle}
          />
          <button
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
              {testing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Zap className="mr-1 h-3 w-3" />}
              Test Connection
            </Button>
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing}>
              {syncing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
              Sync Models
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>

          {testResult && (
            <div className={cn('flex items-center gap-2 px-4 py-2 text-xs', testResult.ok ? 'text-green-600' : 'text-destructive')}>
              {testResult.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
              {testResult.message}
            </div>
          )}

          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Models</p>
            {provider.models.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No models found. Click &quot;Sync Models&quot; to discover available models.
              </p>
            ) : (
              <div className="space-y-1">
                {provider.models.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{model.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {model.modelId}
                        {model.contextWindow && ` · ${(model.contextWindow / 1000).toFixed(0)}K context`}
                      </p>
                    </div>
                    <Switch
                      checked={model.isEnabled}
                      onCheckedChange={(checked: boolean) => onToggleModel(model.modelId, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProvidersPage() {
  const {
    providers,
    isLoading,
    error,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    testConnection,
    syncModels,
    toggleModel,
  } = useProviders();
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const handleAdd = async (data: { name: string; type: string; baseUrl?: string; apiKey?: string }) => {
    await createProvider(data);
  };

  const handleTest = useCallback(async (id: string) => {
    try {
      await testConnection(id);
    } catch {
      // Error handled by the hook
    }
  }, [testConnection]);

  const handleSync = useCallback(async (id: string) => {
    try {
      await syncModels(id);
    } catch {
      // Error handled by the hook
    }
  }, [syncModels]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    await updateProvider(id, { isEnabled: enabled });
  }, [updateProvider]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Providers</h1>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Provider
        </Button>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        Configure LLM providers and enable models for your team&apos;s chat experience.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <Server className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-4 text-sm text-muted-foreground">No providers configured yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Add a provider to enable AI models for chat.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Your First Provider
            </Button>
          </div>
        ) : (
          providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onTest={() => handleTest(provider.id)}
              onSync={() => handleSync(provider.id)}
              onDelete={() => deleteProvider(provider.id)}
              onToggle={(enabled) => handleToggle(provider.id, enabled)}
              onToggleModel={(modelId, enabled) => toggleModel(provider.id, modelId, enabled)}
            />
          ))
        )}
      </div>

      <AddProviderDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleAdd} />
    </div>
  );
}
