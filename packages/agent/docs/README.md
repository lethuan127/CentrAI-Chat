# `@centrai/agent` documentation

- **[Agent runtime pattern](./agent-runtime-pattern.md)** — Design for building a **Mastra** agent from a declarative definition, running in **stream mode**, and extending with tools, MCP, memory, and session state (with Agno-inspired concepts).
- **[Multi-runtime maintenance](./multi-runtime-maintenance.md)** — How to keep **domain/build/compile** framework-agnostic and plug in **alternate runtimes** (e.g. **LangChain**) or a **self-implemented** native adapter (`centrai`) behind `AgentRuntimeAdapter` without duplicating product logic.

## Imports from `apps/` (monorepo)

Run `rg "from '@centrai/agent'" apps/` after refactors. As of the last audit, only these symbols are imported from the API app:

| Symbol | Used in |
| ------ | ------- |
| `createCentrAiChatStream` | `chat.controller.ts` |
| `buildSystemPrompt` | `provider.service.ts` |

Everything else under `src/index.ts` is for the **library surface** (future compile/worker paths or external consumers). Remove or narrow exports only when you accept a breaking change for those consumers.

- **[Discovery audit](./discovery-audit.md)** — Full pass over `@centrai/agent`: who imports what, unused exports, optional cleanups, and removed dead helpers.
