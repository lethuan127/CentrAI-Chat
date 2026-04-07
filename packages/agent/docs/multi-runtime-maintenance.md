# Maintaining multiple agent runtimes (e.g. Mastra, LangChain)

CentrAI can keep **one product-facing agent model** (definition, tools, prompts, session rules) while swapping **how** that model is executed. This note describes how to structure and maintain that split so adding **LangChain** (or another runtime) does not fork your domain logic.

## End-to-end flow

```mermaid
flowchart TB
  subgraph agnostic["Framework-agnostic"]
    D[domain types + tool specs]
    B[build / mergeRunContext / prompt]
    C[compile → CompiledRunPlan]
    D --> B --> C
  end
  subgraph inject["App injects"]
    M[LanguageModel or provider client]
    R[ToolInvocationRouter]
    L[Logger / tracing / abortSignal]
  end
  subgraph adapter["Runtime adapter"]
    F[factory: mastra | langchain | centrai]
    A1[mastra/stream-run]
    A2[langchain/stream-run]
    A3[centrai/stream-run]
    F --> A1
    F --> A2
    F --> A3
  end
  C --> F
  M --> A1
  M --> A2
  M --> A3
  R --> A1
  R --> A2
  R --> A3
  A1 --> OUT[StreamRunResult → API / SSE]
  A2 --> OUT
  A3 --> OUT
```

The API layer should depend only on **agnostic compile output** + **`StreamRunResult`**, never on Mastra `Agent` or LangChain `Runnable`.

---

## Why isolate the runtime

Frameworks differ in:

| Area | Typical differences |
| ---- | ------------------- |
| **Messages** | Role names, multimodal parts, system vs developer system messages, tool-call message pairing. |
| **Tools** | Schema dialect (JSON Schema vs Zod vs raw functions), parallel tool calls, streaming tool args. |
| **Agent loop** | Built-in ReAct loop vs explicit graph (LangGraph) vs framework `stream` with `stopWhen`. |
| **Streaming** | Token deltas vs full message updates vs custom event names (`on_chat_model_stream`, etc.). |
| **Memory** | Thread IDs, checkpointers, vector recall — none of these are portable 1:1. |
| **Dependencies** | AI SDK major versions, peer conflicts, bundle size. |

If `domain/` or `build/` imports a framework, refactors cascade across persistence, admin UI, and tests. A **stable compile artifact** + **thin adapters** limits blast radius.

---

## Layers that stay framework-agnostic

| Layer | Contents | Must not import |
| ----- | -------- | --------------- |
| **Domain** | Agent identity, instructions, `SessionState`, chat roles, message trimming rules, **tool specifications** (function names + JSON parameters, MCP server refs, toolkit nesting). | `@mastra/*`, `langchain`, `@langchain/*` |
| **Build** | Fluent builder, Zod validation, `mergeRunContext`, `buildSystemPrompt`. | Same |
| **Compile** | Inputs: definition snapshot + **RequestContext** (user, workspace, conversation, locale, feature flags). Output: **`CompiledRunPlan`** + optional derived artifacts (e.g. redacted debug dump). | Same |

**Compile** is the last layer that may read Prisma-shaped DTOs *as plain data* (passed in from `apps/api`), but it should not use NestJS decorators or HTTP types.

---

## `CompiledRunPlan` (suggested shape)

Treat this as **versioned product data** (e.g. `planVersion: 1`). Adapters read fields they understand and ignore unknown keys only if forward compatibility is intentional.

| Field | Purpose |
| ----- | ------- |
| `planVersion` | Bump when semantics change; adapters can assert supported range. |
| `agentId`, `runId` | Correlation, logs, tracing (optional `runId` generated per HTTP request). |
| `instructions` | Final system string after preamble, session injection, and policy blocks. |
| `messages` | **Normalized** chat turns in a **single** internal enum (see [Message normalization](#message-normalization)). |
| `toolContracts` | Ordered list: `{ kind: 'function', name, description?, parametersJsonSchema }` and/or `{ kind: 'mcp', ... }` after flattening toolkits. |
| `limits` | `maxSteps`, `maxToolRoundtripMs`, `maxTotalMs`, optional `maxOutputTokens`. |
| `streaming` | Flags: `includeUsage`, `includeRawReasoning` (if product ever exposes it). |
| `memory` | **Neutral** descriptor only, e.g. `{ mode: 'none' } \| { mode: 'app_thread', threadKey: string } \| { mode: 'mastra_pg', thread, resource }`. Adapters that do not support a mode **fail fast** at compile or factory time, not mid-stream. |
| `metadata` | Small JSON bag for A/B flags (e.g. `runtimePreference: 'mastra'`). |

Anything that cannot be serialized (live MCP sockets, DB handles) stays in **`AdapterDeps`**, not inside `CompiledRunPlan`.

---

## `AdapterDeps` (per request, injected by API)

| Dep | Role |
| --- | ---- |
| `model` | AI SDK `LanguageModel` **or** a tagged union `{ type: 'ai-sdk', model } \| { type: 'langchain-base', chatModel }` if you must pass a LC model before a universal bridge exists. Prefer **one** model abstraction long-term. |
| `abortSignal` | Cooperative cancellation; adapters must wire to underlying stream/abort. |
| `invokeTool` | `(call: { name: string; args: unknown }) => Promise<ToolResult>` — **the only** execution path for function tools (auditing, timeouts, RBAC). |
| `logger` | Structured logger with `runId`, `adapter: 'mastra' \| 'langchain'`. |
| `mastra?.postgresStore` | Optional; only Mastra adapter reads it. |

**Rule:** adapters never import Prisma. They receive **closures** or **ports** the API constructs.

---

## Runtime adapter interface (conceptual TypeScript)

Exact names live in code; this is the contract to implement once per backend:

```typescript
// runtime/types.ts — no framework imports
export interface StreamRunResult {
  /** UI stream for merge into createUIMessageStream / SSE */
  uiStream: ReadableStream<unknown>;
  /** Await after stream settles (same as today’s mastraOutput.text pattern) */
  text: Promise<string>;
  /** Optional; omit if runtime cannot supply token splits */
  usage?: Promise<{ inputTokens?: number; outputTokens?: number } | undefined>;
  /** Optional raw handle for debugging or adapter-specific metrics */
  raw?: unknown;
}

export interface AgentRuntimeAdapter {
  readonly id: 'mastra' | 'langchain' | 'centrai'; // `centrai` = self-implemented / native adapter

  streamRun(plan: CompiledRunPlan, deps: AdapterDeps): Promise<StreamRunResult>;

  /** Declare support so compile/factory can reject impossible combos early */
  supports(plan: CompiledRunPlan): { ok: true } | { ok: false; reason: string };
}

export function createRuntimeAdapter(
  config: { kind: 'mastra' | 'langchain' | 'centrai' },
): AgentRuntimeAdapter {
  // single import site per implementation (dynamic import optional for bundle splitting)
  ...
}
```

**`supports` examples:**

- Plan requests `memory.mode: 'mastra_pg'` but `deps.mastra` is missing → `ok: false`.
- Plan has MCP tools but LangChain adapter has not implemented MCP client pool → `ok: false` until implemented.

---

## Self-implemented runtime (native / `centrai`)

A valid product goal is to **own the execution loop** instead of delegating it to Mastra or LangChain. In this architecture that is just **another `AgentRuntimeAdapter`**: same **`CompiledRunPlan`** in, same **`StreamRunResult`** out. Frameworks become optional accelerators, not the definition of “what an agent is.”

### Why do it

| Motivation | What you gain |
| ---------- | --------------- |
| **Control** | Exact semantics for `maxSteps`, parallel tool calls, backoff, and error recovery. |
| **Dependencies** | Smaller or more predictable dependency surface (e.g. only `ai` + your provider clients). |
| **Debugging** | Every branch in the loop is your code; no opaque agent runtime. |
| **Lock-in** | Product behavior does not move when a vendor rewrites defaults or streaming shapes. |

### What you still do *not* need to reinvent

- **Tokenization and provider wire format** — Keep using **AI SDK** `LanguageModel` (`streamText` / `generateText` or step APIs) inside your adapter so OpenAI, Anthropic, and others stay normalized.
- **Wire protocol to the browser** — Still emit the **same** `uiStream` chunk types as other adapters (`runtime/shared/chunk-types.ts` or equivalent).
- **Tool security and audit** — Still route every tool execution through **`invokeTool`** in `AdapterDeps`; the native loop only *schedules* calls.

### What you *do* implement

1. **Agent loop** — Until the model returns final text (or `maxSteps`):
   - Call the model with `instructions` + current `messages` + tool definitions derived from `plan.toolContracts`.
   - Parse **tool calls** from the model response (including **parallel** calls if you support them).
   - For each call: `await deps.invokeTool({ name, args })`, append tool results to `messages`, repeat.
2. **Streaming** — While the model streams:
   - Forward text deltas and (if supported) tool-call deltas into **`uiStream`** in the canonical shape.
   - Resolve **`text`** and **`usage`** promises when the turn completes (aggregate usage across steps if the provider exposes step-level usage).
3. **Cancellation** — Respect **`abortSignal`** between steps and inside stream readers.
4. **`supports(plan)`** — Declare which `memory.mode` values you implement (often `none` + `app_thread` only at first; `mastra_pg` → `ok: false` unless you add a parallel store).

You are **not** required to use Mastra or LangChain inside this adapter; the folder name `runtime/centrai/` (or `runtime/native/`) is your **owned** implementation.

### Suggested layout (add to `runtime/`)

```text
runtime/centrai/                    # or runtime/native/
├── index.ts
├── stream-run.ts                   # implements AgentRuntimeAdapter.streamRun
├── agent-loop.ts                 # while (steps++) { model → tools → append }
├── model-step.ts                 # single streamText/generateText invocation
├── bind-ai-sdk-tools.ts          # ToolContract[] → AI SDK tool() with execute → invokeTool
└── stream-to-ui-chunks.ts        # AI SDK stream parts → ReadableStream (canonical chunks)
```

**Dependency rule:** `runtime/centrai/*` may import **`ai`** (and provider types your monorepo already uses) plus **`runtime/shared/*`**. It must **not** import `runtime/mastra/*` or `runtime/langchain/*`.

### Practical bootstrap path

1. Implement **`streamRun`** for **no tools** (plain streaming text) and match **`StreamRunResult`** contract tests.
2. Add **function tools** via AI SDK `tool()` + `invokeTool`.
3. Add **parallel tool calls** and ordering guarantees (document whether you run tools sequentially or with `Promise.all` and how errors aggregate).
4. Add **MCP** only after function tools are stable (often by expanding MCP to contracts at compile time, same as other adapters).

### Tradeoffs (own the runtime)

- **You maintain** edge cases: malformed tool JSON, provider-specific quirks, streaming tool arguments, mid-stream abort.
- **Feature velocity** for exotic features (built-in memory UI, traces) may lag behind a full framework until you add them deliberately.
- **Testing burden** is higher but **more localized**: golden plans + mock `LanguageModel` can cover most of the loop without E2E.

Shipped behavior for **`centrai`** should be tracked in the [capability matrix](#capability-matrix-maintain-this-table-in-repo) above (Native column).

---

## Message normalization

Pick **one** internal message model in `domain/` or `compile/`, then map at the **adapter boundary**:

| Internal role | Mastra / AI SDK | LangChain (typical) |
| ------------- | --------------- | ------------------- |
| `system` | system message / instructions param | `SystemMessage` |
| `user` | user | `HumanMessage` |
| `assistant` | assistant | `AIMessage` |
| `tool` | tool result with `toolCallId` | `ToolMessage` linked to prior tool calls |

**Tool-call pairing:** Store enough in internal messages so both stacks can rebuild history: `toolCallId`, `toolName`, `args` snapshot (or opaque ref if args are huge). Adapters map to framework-specific shapes.

**Multimodal:** If v1 is text-only, define `content: { type: 'text', text }[]` internally so adding images later does not break the plan schema.

---

## Tools: from spec to execution

1. **Persisted spec** (`RuntimeTool` in domain) → compile step produces **`toolContracts`** (flat list).
2. **Router** (`invokeTool`) implements **allowlist** by contract names; rejects unknown tools even if the model hallucinates a name.
3. **Adapter responsibility:**
   - **Mastra / AI SDK:** build `tool({ ... })` definitions whose `execute` calls `invokeTool`.
   - **LangChain:** `bindTools` / tool classes whose `invoke` delegates to the same `invokeTool`.

**MCP:** Compile can expand MCP into concrete `toolContracts` after a **capability fetch** (in API or worker), or attach a **dynamic tool source** only in adapters that support it. Do not put raw WebSocket handles inside `CompiledRunPlan`.

**Idempotency and side effects:** Document which tools are read-only vs mutating; the router enforces policy, not the runtime.

---

## Normalized streaming (canonical wire format)

**Recommendation:** standardize on **AI SDK v6 UI stream chunks** (or your current `InferUIMessageChunk` shape) as the only type that crosses from `@centrai/agent` into `apps/api`.

| Source | Bridge |
| ------ | ------ |
| Mastra | Existing `toAISdkStream(mastraOutput, { from: 'agent', version: 'v6' })`. |
| LangChain | Custom `ReadableStream` transformer: subscribe to `streamEvents` or model stream, emit **the same** chunk types your UI already handles (text-delta, tool-call, tool-result, finish, error). |
| Native (`centrai`) | Map **AI SDK** `streamText` / multi-step stream parts directly into the same canonical chunk types (or wrap with a small `stream-to-ui-chunks` helper). |

**Degradation policy:**

- If LangChain cannot stream tool-call **arguments** incrementally, emit a single tool-call chunk when args are complete; document in the capability matrix.
- If usage is unavailable, resolve `usage` to `undefined` and let persistence skip token fields rather than fabricating numbers.

---

## Capability matrix (maintain this table in-repo)

| Capability | Mastra adapter | LangChain adapter | Native (`centrai`) | Notes |
| ---------- | -------------- | ----------------- | ------------------ | ----- |
| Text streaming | Yes | Yes | Yes (you map AI SDK stream → chunks) | Single canonical UI stream shape for all three. |
| Parallel tool calls | Framework-dependent | Framework-dependent | You define policy | Test each adapter with a mock model. |
| Token usage | If exposed on output | Often via callbacks / metadata | From AI SDK / summed per step | Normalize to `inputTokens` / `outputTokens`. |
| `maxSteps` / loop cap | `stopWhen: stepCountIs(n)` | LangGraph recursion limit or custom loop | Your `agent-loop.ts` | Same `plan.limits.maxSteps` drives all. |
| Mastra PG memory | Yes | N/A | Typically N/A | Plan `memory.mode` must gate this. |
| MCP tools | Target | Target | Target | Shared expansion + `invokeTool` router. |
| Cancellation | `abortSignal` | LC abort / stream controller | `abortSignal` between steps | Required for UX. |

When a row is “Target”, track it in issues; do not imply parity in product copy until the row is “Yes”.

---

## LangChain-specific notes (high level)

The JS ecosystem has multiple entry styles:

- **LCEL + `bindTools`** on a chat model for a **single** model step; you still need an **outer loop** for tool → model → tool, comparable to Mastra’s agent loop.
- **LangGraph** for explicit state machines; better when you need deterministic branches, HITL, or persistent checkpoints — but **higher maintenance** to map into a simple “one user turn” chat endpoint.

For CentrAI’s **chat turn** shape, prefer the **smallest** LangChain surface that matches `CompiledRunPlan`: one subgraph or loop that:

1. Sends `instructions` + `messages` to the model with tools bound.
2. On tool calls, runs `invokeTool` and appends results.
3. Stops when the model returns text-only or `maxSteps` is hit.
4. Streams via a single outbound transformer to **AI SDK chunks**.

Avoid exposing LangGraph state channels to `apps/api`.

---

## Folder layout (comprehensive)

This layout targets **`packages/agent`** as the single home for **framework-agnostic** agent logic plus **runtime adapters**. Names are suggestions; keep the **dependency direction** even if you flatten some folders during early implementation.

### Package root

```text
packages/agent/
├── package.json
├── tsconfig.json
├── README.md                         # short: purpose, link to docs/
├── docs/                             # architecture notes (this file, etc.)
├── src/
│   └── …                             # see below
└── test/                             # or co-located *.test.ts — pick one convention
    ├── fixtures/
    │   └── plans/                    # golden CompiledRunPlan JSON
    ├── domain/
    ├── build/
    ├── compile/
    ├── tools/
    └── runtime/
        ├── mastra/
        └── langchain/
```

### `src/` — full tree

```text
src/
├── index.ts                          # PUBLIC API ONLY: builder, compile entry, stream facade, stable types
├── errors.ts                         # AgentBuildError, CompileError, AgentRuntimeError, codes
│
├── domain/                           # zero framework imports
│   ├── index.ts                      # barrel (optional)
│   ├── agent-definition.ts           # core types: identity, role, instructions, expectedOutput
│   ├── message.ts                    # ChatMessage, roles, trim/slice/append helpers
│   ├── session-state.ts              # SessionState, merge helpers, format for prompt
│   ├── prompt.ts                     # buildSystemPrompt(SystemPromptInput)
│   └── tool-spec.ts                  # Zod: RuntimeTool, flatten, parse from JSON
│
├── build/                            # depends on domain only
│   ├── index.ts
│   ├── system-prompt-from-definition.ts  # definitionToSystemPromptInput, systemPromptFromDefinition
│   ├── from-persistence.ts           # runtimeAgentDefinitionFromPersisted(Prisma-shaped DTO)
│   └── merge-run-context.ts          # definition + MergeRunContextOptions → messages + session
│
├── compile/                          # depends on domain + build
│   ├── index.ts
│   ├── compiled-run-plan.ts          # CompiledRunPlan type, planVersion, validators
│   ├── request-context.ts            # RequestContext (userId, workspaceId, convId, flags, …)
│   └── compile-agent-turn.ts         # snapshot + context → CompiledRunPlan (use domain `flattenRuntimeTools` until neutral ToolContract types land)
│
├── tools/                            # execution helpers; NO mastra/langchain here
│   ├── index.ts
│   ├── invocation-router.ts          # allowlist, timeouts, invokeTool implementation type
│   ├── function-tools.ts             # map ToolContract → AI-SDK-shaped tool defs (data only)
│   ├── mcp/
│   │   ├── types.ts                  # MCP connection descriptors (serializable)
│   │   ├── expand-contracts.ts       # optional: resolve MCP catalog → ToolContract
│   │   └── client-factory.ts         # interface only; live client from apps/api implements
│   └── safety.ts                     # redaction, size limits on args/results
│
└── runtime/                          # framework-specific; see dependency rules below
    ├── index.ts                      # re-export createRuntimeAdapter, StreamRunResult
    ├── types.ts                      # AdapterDeps, StreamRunResult, AgentRuntimeAdapter
    ├── factory.ts                    # env + plan → pick adapter; calls supports()
    │
    ├── shared/                       # Mastra AND LangChain safe: no imports from mastra/ or langchain/
    │   ├── streams.ts                # AbortController helpers, tee/guard ReadableStream
    │   ├── chunk-types.ts            # document canonical UI chunk shape (type-only / constants)
    │   └── to-ai-sdk-ui-stream.ts    # optional shared transformer utilities (still neutral)
    │
    ├── mastra/
    │   ├── index.ts
    │   ├── stream-run.ts             # CompiledRunPlan + deps → StreamRunResult
    │   ├── create-agent.ts           # Mastra Agent wiring (memory, model cast)
    │   └── memory-postgres.ts        # thin re-export / factory for PostgresStore (optional)
    │
    └── langchain/
        ├── index.ts
        ├── stream-run.ts             # entry: plan + deps → StreamRunResult
        ├── agent-loop.ts             # tool ↔ model loop, maxSteps
        ├── bind-tools.ts             # ToolContract[] + invokeTool → LC-bound tools
        └── stream-bridge.ts          # LC events → AI SDK UI chunk stream
    │
    └── centrai/                      # self-implemented runtime (no Mastra/LangChain)
        ├── index.ts
        ├── stream-run.ts             # AgentRuntimeAdapter implementation
        ├── agent-loop.ts             # owned tool ↔ model loop
        ├── model-step.ts             # AI SDK streamText / generateText per step
        ├── bind-ai-sdk-tools.ts      # contracts → tool() + invokeTool
        └── stream-to-ui-chunks.ts    # → canonical uiStream
```

### What each layer may import

| From → To | domain | build | compile | tools | runtime/shared | runtime/mastra | runtime/langchain | runtime/centrai |
| --------- | ------ | ----- | ------- | ----- | -------------- | -------------- | ----------------- | --------------- |
| **domain** | — | no | no | no | no | no | no | no |
| **build** | yes | — | no | no | no | no | no | no |
| **compile** | yes | yes | — | optional types only | no | no | no | no |
| **tools** | yes | no | optional contracts | — | no | no | no | no |
| **runtime/shared** | optional | no | no | no | — | no | no | no |
| **runtime/mastra** | no* | no | no | optional (tool shape helpers) | yes | — | **never** | **never** |
| **runtime/langchain** | no* | no | no | optional | yes | **never** | — | **never** |
| **runtime/centrai** | no* | no | no | optional | yes | **never** | **never** | — |

\*Adapters should consume **`CompiledRunPlan`** and **`AdapterDeps`**, not raw domain builders. If a shared type is needed, lift it to **`runtime/types.ts`** or **`compile/compiled-run-plan.ts`**.

### Public surface (`src/index.ts`)

Export only what `apps/api` and `apps/worker` need:

- Build: `runtimeAgentDefinitionFromPersisted`, `mergeRunContext`, `systemPromptFromDefinition`, related types.
- Compile: `compileAgentTurn`, `CompiledRunPlan`, `RequestContext`.
- Run: `createRuntimeAdapter` (or a single `streamAgentTurn` that compiles + runs), `StreamRunResult`.
- Domain utilities that are part of the product contract: `ChatMessage`, `parseRuntimeTools`, etc.

Do **not** export `runtime/mastra/*`, `runtime/langchain/*`, or `runtime/centrai/*` internals unless another workspace package is a dedicated adapter extension.

### Optional monorepo splits

When peer dependencies or bundle size hurt default installs:

```text
packages/agent/                    # core: domain, build, compile, tools, runtime/shared, runtime/mastra
packages/agent-langchain/          # depends on @centrai/agent; exports LangChain adapter only
# or
packages/agent-mastra/             # if you invert: tiny core + both adapters as plugins (heavier workspace)
```

Recommended default: **keep Mastra in `@centrai/agent`**, move **LangChain** to **`@centrai/agent-langchain`** that implements `AgentRuntimeAdapter` and is loaded via dynamic import from `factory.ts` when `AGENT_RUNTIME=langchain`.

### Hard rules (summary)

1. **`runtime/mastra/*`, `runtime/langchain/*`, `runtime/centrai/*`**: no cross-imports between these folders (each adapter is isolated).
2. **`domain/*`, `build/*`, `compile/*`**: no `@mastra/*`, `langchain`, `@langchain/*`.
3. **Framework-specific streaming**: only under `runtime/<framework>/`.
4. **Canonical stream shape to the API**: produced by adapters; document in `runtime/shared/chunk-types.ts` or in `apps/api` consumer types — one source of truth.
5. **Tests** mirror `src/` under `test/` (or co-locate) so each layer has fast unit tests without spinning real LLMs.

---

## Selecting a runtime

| Mechanism | Use when |
| --------- | -------- |
| `AGENT_RUNTIME` env | Staging experiments, local dev (`mastra` \| `langchain` \| `centrai`). |
| Workspace / agent DB flag | Some agents require LangGraph features. |
| Compile-time `metadata.runtimePreference` | Per-request override (admin testing). |

**Fallback** (e.g. LangChain fails → Mastra): only if product accepts **non-deterministic** differences; log `adapter_error` + `fallback_to`. Never silently fallback in regulated or billing-sensitive flows without explicit policy.

---

## Testing strategy

1. **Golden `CompiledRunPlan` fixtures** — JSON files in `test/fixtures/plans/` representing typical agent, tool-heavy agent, MCP-expanded agent.
2. **Contract tests per adapter** — Mock model that emits: (a) plain text stream, (b) single tool call, (c) parallel tool calls. Assert **ordered chunk types** (allow flexible ids/timestamps).
3. **Router integration** — One test module ensures **every** adapter calls `invokeTool` with identical `name`/`args` for the same model behavior (use a fake model script).
4. **Cancellation** — Abort mid-stream; assert no further `invokeTool` after abort.
5. **supports()** — Table-driven tests for impossible `memory.mode` + deps combinations.

Favor **fast unit tests** on adapters; reserve E2E for one path through the API with each runtime.

---

## Observability and errors

- **Structured logs:** `runId`, `adapterId`, `agentId`, `planVersion`, `durationMs`, `stepCount`, `toolCallCount`.
- **Tracing:** One span `agent.runtime.stream` with attributes `adapter`, `modelId` (if safe), not raw prompts unless policy allows.
- **Errors:** Wrap framework errors in `AgentRuntimeError` with `cause`, `adapterId`, and **no** secrets. Map to HTTP in the API layer only.

---

## Dependency and upgrade playbook

- **Pin** LangChain and Mastra minors in lockfile; upgrade one adapter at a time.
- When **AI SDK** majors bump, update **both** bridges in the same PR or feature flag until chunk compatibility is verified.
- If peer dependency conflicts appear, split LangChain into **`packages/agent-langchain`** before forcing the whole monorepo onto one version.

---

## Tradeoffs (summary)

- **N adapters ⇒ N streaming bridges + N contract suites** (including your own **`centrai`** loop). Budget maintenance accordingly; native runtime trades vendor magic for **local** complexity you control.
- **Semantic drift** across frameworks is normal; document differences in the capability matrix, not only in code comments.
- **Memory:** Keep **canonical user chat** in Prisma; use framework memory as an **optional accelerator** with explicit `memory.mode`, not as a second source of truth for the UI.

---

## Relation to the Mastra-first pattern

The [agent runtime pattern](./agent-runtime-pattern.md) remains: **build → compile → stream**. This document specifies that **stream** is implemented by **`AgentRuntimeAdapter`**, so Mastra is one **implementation**; a **self-implemented** `centrai` adapter is equally valid and keeps domain/build/compile free of vendor agent runtimes.

---

## References

- [LangChain.js streaming](https://js.langchain.com/docs/concepts/streaming)
- [LangGraph overview](https://langchain-ai.github.io/langgraphjs/) — when you need graphs vs a simple loop
- [Mastra streaming / AI SDK](https://mastra.ai/docs)
