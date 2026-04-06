import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          CentrAI-Chat
        </h1>
        <p className="text-lg text-fd-muted-foreground">
          Open-source centralized AI conversation platform. Configure providers,
          publish agents, and let users chat — all from one place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/docs"
            className="inline-flex items-center rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            Get Started
          </Link>
          <Link
            href="/docs/api-reference"
            className="inline-flex items-center rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            API Reference
          </Link>
          <a
            href="https://github.com/lethuan127/CentrAI-Chat"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            GitHub
          </a>
        </div>

        <div className="grid gap-4 pt-8 sm:grid-cols-3 text-left">
          <div className="rounded-lg border border-fd-border p-4">
            <h3 className="font-semibold">Multi-Provider</h3>
            <p className="mt-1 text-sm text-fd-muted-foreground">
              OpenAI, Anthropic, Google Gemini, Ollama — one unified interface.
            </p>
          </div>
          <div className="rounded-lg border border-fd-border p-4">
            <h3 className="font-semibold">Agent Builder</h3>
            <p className="mt-1 text-sm text-fd-muted-foreground">
              Create agents with system prompts, model bindings, and version control.
            </p>
          </div>
          <div className="rounded-lg border border-fd-border p-4">
            <h3 className="font-semibold">Self-Hostable</h3>
            <p className="mt-1 text-sm text-fd-muted-foreground">
              One-command Docker Compose deployment. Your data stays on your infra.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
