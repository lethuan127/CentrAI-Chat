'use client';

import { Server } from 'lucide-react';

export default function AdminLlmEnvPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center gap-3">
        <Server className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">LLM credentials</h1>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        CentrAI-Chat no longer stores LLM API keys in the database. Configure the API process environment on the server
        that runs <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">apps/api</code> (see the repo{' '}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.example</code>).
      </p>

      <div className="mt-8 space-y-6 text-sm">
        <section>
          <h2 className="text-base font-semibold">OpenAI</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
            <li>
              <code className="font-mono text-xs">OPENAI_API_KEY</code> — required for OpenAI models
            </li>
            <li>
              <code className="font-mono text-xs">OPENAI_BASE_URL</code> — optional (defaults to OpenAI&apos;s API)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Anthropic</h2>
          <p className="mt-2 text-muted-foreground">
            <code className="font-mono text-xs">ANTHROPIC_API_KEY</code>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Google Gemini</h2>
          <p className="mt-2 text-muted-foreground">
            <code className="font-mono text-xs">GOOGLE_API_KEY</code>
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Ollama</h2>
          <p className="mt-2 text-muted-foreground">
            No API key. Optional <code className="font-mono text-xs">OLLAMA_BASE_URL</code> (default{' '}
            <code className="font-mono text-xs">http://localhost:11434/v1</code> for the OpenAI-compatible path).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Custom OpenAI-compatible</h2>
          <p className="mt-2 text-muted-foreground">
            Set <code className="font-mono text-xs">CUSTOM_OPENAI_BASE_URL</code> and{' '}
            <code className="font-mono text-xs">CUSTOM_OPENAI_API_KEY</code> (or rely on{' '}
            <code className="font-mono text-xs">OPENAI_API_KEY</code> if your gateway accepts it). Use backend key{' '}
            <code className="font-mono text-xs">custom</code> in agents and model ids like{' '}
            <code className="font-mono text-xs">custom/your-model-name</code>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Defaults</h2>
          <p className="mt-2 text-muted-foreground">
            <code className="font-mono text-xs">DEFAULT_MODEL</code> — e.g. <code className="font-mono text-xs">openai/gpt-4o-mini</code>
          </p>
        </section>
      </div>
    </div>
  );
}
