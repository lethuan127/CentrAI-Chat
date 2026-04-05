'use client';

import { AgentForm } from '@/components/admin/agent-form';

export default function NewAgentPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Create Agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Define a new agent with a system prompt, model, and parameters.
      </p>
      <div className="mt-8">
        <AgentForm />
      </div>
    </div>
  );
}
