# `@centrai/agent` documentation

CentrAI’s **agent runtime** package: turn persisted or in-memory **agent definitions** into a **Mastra**-backed agent, run chat turns in **stream** mode, and expose a single **AI SDK** UI stream to `apps/api` and the web app.

## Re-implementation plan (direction)

The package is being **re-implemented** around Mastra as the **only** execution kernel we optimize for. The target shape:

| Layer | Intent |
| ----- | ------ |
| **Definition → Mastra `Agent`** | Map CentrAI’s declarative definition (instructions, tools as data, memory flags, session defaults) into a **`Agent`** from `@mastra/core/agent`, configured like a normal Mastra agent (model, instructions, tools, optional memory). Prefer **subclassing or factory** so our “CentrAI agent” is a thin specialization of Mastra’s `Agent` API rather than a parallel abstraction. |
| **Messages** | Normalize UI / API messages with **`@mastra/core/agent/message-list`** (and related helpers) so the runtime speaks Mastra’s message model consistently before `stream()`. |
| **Memory** | When enabled, wire **`@mastra/memory`** (and storage such as Mastra `PostgresStore` where applicable) with explicit **thread / resource** scopes; keep **Prisma** as the canonical user-visible transcript unless a feature deliberately uses Mastra memory. |
| **Stream out** | Run **`Agent.stream(...)`** (or the supported Mastra streaming entrypoint) and convert the Mastra stream to the UI protocol with **`toAISdkStream`** from **`@mastra/ai-sdk`** (e.g. `{ from: 'agent', version: 'v6' }`) so the API can merge into **`createUIMessageStream`** unchanged. |

**Contract for consumers:** a small public surface—**build** (definition → Mastra agent + run inputs), **run** (stream + `toAISdkStream`), **types** (`StreamRunResult` / usage for persistence)—while HTTP, auth, and DB persistence stay in **`apps/api`**.

## Detailed docs

- **[Architecture](./architecture.md)** — Components, diagrams, proposed file layout, and **pattern-aligned naming** (`createMastraAgent`, `createMastraTools`, **`runtime/stream-run.ts`**, facade). See **[Creating a Mastra Agent (step by step)](./architecture.md#creating-a-mastra-agent-step-by-step)** for the build flowchart and sequence diagram.
- **[Agent runtime pattern](./agent-runtime-pattern.md)** — Build → run → stream lifecycle, Agno-inspired concept map, tools/MCP/memory/session extension points, and current implementation notes.
- **[Multi-runtime maintenance](./multi-runtime-maintenance.md)** — Keeping domain code framework-agnostic and optional alternate runtimes behind an adapter (historical / exploratory; **Mastra remains the primary path** for the re-implementation).
- **[Discovery audit](./discovery-audit.md)** — Import graph, exports, and cleanup candidates (re-run after refactors).

## Imports from `apps/` (monorepo)

After refactors, verify with:

```bash
rg "from '@centrai/agent'" apps/ packages/ --glob '!packages/agent/**'
```

Snapshot of **current** API usage (update this table when exports change):

| Symbol | Used in |
| ------ | ------- |
| `createCentrAiChatStream` | `apps/api/src/chat/chat.controller.ts` |
| `buildSystemPrompt`, `runtimeAgentDefinitionFromPersisted` | `apps/api/src/llm/llm.service.ts` |

Anything else exported from `src/index.ts` is for **library consumers**, workers, or future compile paths; tightening exports is a **breaking change** for those call sites.

## Package layout (reference)

Source lives under `packages/agent/src/` — typically `build/`, `domain/`, `runtime/` — see the detailed docs above for how those map to Mastra after the re-implementation.
