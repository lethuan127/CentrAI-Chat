'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  Loader2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
} from 'lucide-react';
import { useSystemSettings } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  enabled,
  onToggle,
  danger,
}: {
  enabled: boolean;
  onToggle: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        enabled
          ? danger ? 'bg-destructive' : 'bg-primary'
          : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      min={min}
      max={max}
      className="h-9 w-28 rounded-lg border border-border bg-background px-3 text-right text-sm tabular-nums outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
    />
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-64 rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
    />
  );
}

export default function AdminSettingsPage() {
  const { settings, isLoading, error, isSaving, updateSettings } = useSystemSettings();

  const [form, setForm] = useState({
    defaultModel: '',
    defaultProvider: '',
    registrationEnabled: true,
    maxConversationsPerUser: 1000,
    maxMessagesPerConversation: 500,
    rateLimitPerMinute: 60,
    maintenanceMode: false,
  });

  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setDirty(false);
    }
  }, [settings]);

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await updateSettings(form);
      setDirty(false);
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">System Settings</h1>
        </div>
        <div className="mt-8 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">System Settings</h1>
        </div>
        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className="text-sm text-green-600">{saveMessage}</span>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || isSaving}
            className={cn(
              'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
              dirty
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 divide-y divide-border rounded-lg border border-border">
        <div className="px-5">
          <SettingRow
            label="Default Model"
            description="The model used when no specific model is selected. Format: provider/model-id"
          >
            <TextInput
              value={form.defaultModel}
              onChange={(v) => update('defaultModel', v)}
              placeholder="openai/gpt-4o-mini"
            />
          </SettingRow>
        </div>

        <div className="px-5">
          <SettingRow
            label="Default Provider"
            description="Preferred provider ID for fallback when the primary provider fails"
          >
            <TextInput
              value={form.defaultProvider}
              onChange={(v) => update('defaultProvider', v)}
              placeholder="Provider ID"
            />
          </SettingRow>
        </div>

        <div className="px-5">
          <SettingRow
            label="User Registration"
            description="Allow new users to create accounts. When disabled, only admins can invite users."
          >
            <Toggle
              enabled={form.registrationEnabled}
              onToggle={() => update('registrationEnabled', !form.registrationEnabled)}
            />
          </SettingRow>
        </div>

        <div className="px-5">
          <SettingRow
            label="Max Conversations per User"
            description="Maximum number of conversations a single user can create"
          >
            <NumberInput
              value={form.maxConversationsPerUser}
              onChange={(v) => update('maxConversationsPerUser', v)}
              min={1}
              max={100000}
            />
          </SettingRow>
        </div>

        <div className="px-5">
          <SettingRow
            label="Max Messages per Conversation"
            description="Maximum number of messages allowed in a single conversation thread"
          >
            <NumberInput
              value={form.maxMessagesPerConversation}
              onChange={(v) => update('maxMessagesPerConversation', v)}
              min={1}
              max={10000}
            />
          </SettingRow>
        </div>

        <div className="px-5">
          <SettingRow
            label="Rate Limit (per minute)"
            description="Maximum API requests per user per minute"
          >
            <NumberInput
              value={form.rateLimitPerMinute}
              onChange={(v) => update('rateLimitPerMinute', v)}
              min={1}
              max={1000}
            />
          </SettingRow>
        </div>

        <div className="px-5">
          <SettingRow
            label="Maintenance Mode"
            description="When enabled, only admins can access the platform. All other users see a maintenance page."
          >
            <div className="flex items-center gap-2">
              {form.maintenanceMode && (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <Toggle
                enabled={form.maintenanceMode}
                onToggle={() => update('maintenanceMode', !form.maintenanceMode)}
                danger
              />
            </div>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}
