# CentrAI-Chat — Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Clients                                    │
│   Next.js Web App  ·  Mobile (future)  ·  API consumers / SDKs     │
└──────────┬──────────────────┬───────────────────────┬───────────────┘
           │ HTTP/REST        │ SSE (streaming)       │ HTTP/REST
           ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API Gateway / Reverse Proxy                     │
│                  (Nginx / Traefik — rate limit, TLS)                │
└──────────┬──────────────────┬───────────────────────┬───────────────┘
           │                  │                       │
           ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        NestJS Backend                               │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ │
│  │   Auth   │ │   Chat   │ │  Agent    │ │ Provider │ │  Admin  │ │
│  │ Module   │ │ Service  │ │ Service   │ │ Adapter  │ │ Module  │ │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────┬─────┘ └────┬────┘ │
│       │             │             │             │            │      │
│  ┌────┴─────────────┴─────────────┴─────────────┴────────────┴───┐ │
│  │              Message Router / Orchestrator                     │ │
│  └───────────────────────────┬───────────────────────────────────┘ │
│                              │                                     │
│  ┌───────────────────────────┴───────────────────────────────────┐ │
│  │      Workspace & Team Management (v2 — schema-ready in v1)    │ │
│  └───────────────────────────┬───────────────────────────────────┘ │
│                              │                                     │
│  ┌───────────────────────────┴───────────────────────────────────┐ │
│  │                    Audit / Logging Module                      │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────┬──────────────┬──────────────┬──────────────┬──────────────────┘
      │              │              │              │
      ▼              ▼              ▼              ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────────┐
│ Postgres │  │  Redis   │  │  Object  │  │  LLM Providers      │
│ (primary │  │ (cache,  │  │  Storage │  │  OpenAI · Anthropic  │
│  + pgvec)│  │  queue,  │  │ (S3/Min) │  │  Gemini · Ollama     │
│          │  │  pubsub) │  │          │  │  (OpenAI-compat API) │
└──────────┘  └──────────┘  └──────────┘  └─────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js (App Router, React Server Components) | Full-stack React framework; SSR for SEO on public pages, client components for chat UI. |
| **Backend API** | NestJS (TypeScript) | Modular, decorator-driven framework with built-in DI, guards, interceptors, and SSE streaming. |
| **Database** | PostgreSQL (+ pgvector extension) | Battle-tested relational DB; pgvector enables vector search for future RAG without a separate vector DB in v1. |
| **ORM** | Prisma | Type-safe schema management, migrations, and query building. |
| **Realtime** | Server-Sent Events (SSE) over HTTP | Streaming LLM responses token-by-token via `text/event-stream`. Zero additional dependencies; works through all HTTP proxies and load balancers. |
| **Queue / Workers** | Redis (BullMQ) | Background job processing: LLM calls, embedding generation, webhook delivery, audit log writes. |
| **Cache** | Redis | Session cache, rate-limit counters, hot conversation caching. |
| **Auth** | Auth.js / Clerk / Keycloak / Supabase Auth (pluggable) | Externalize auth complexity; swap providers without touching core business logic. |
| **Object Storage** | S3-compatible (MinIO for self-hosted, AWS S3 for cloud) | File attachments, document uploads, export artifacts. |
| **Deployment** | Docker Compose (v1) → Kubernetes + Helm (v2) | Compose for fast local dev and small deployments; K8s for production scale. |
| **CI/CD** | GitHub Actions | Lint, test, build, push images, deploy. |
| **Observability** | OpenTelemetry → Grafana stack (Loki, Tempo, Prometheus) | Structured logs, distributed tracing, metrics — all in one pipeline. |

---

## Main Modules

### 1. Chat Service

Owns the lifecycle of conversations and messages.

**Responsibilities:**
- Create, list, archive, delete conversations
- Append user/assistant/system/tool messages to a conversation, tagged by `ContentType` (`TEXT`, `THINKING`, `TOOL_CALL`, `TOOL_RESULT`)
- Stream assistant responses back to the client via SSE (Server-Sent Events)
- Manage conversation branching (edit-and-regenerate creates a fork)
- Persist token usage metadata per message
- Emit events for audit logging and analytics

**Key interfaces:**
```
ChatService
  ├── createConversation(userId, options)
  ├── sendMessage(conversationId, content, attachments?)
  ├── streamResponse(conversationId) → Observable<token>
  ├── forkConversation(conversationId, fromMessageId)
  ├── listConversations(userId, filters, pagination)
  └── deleteConversation(conversationId)
```

**Dependencies:** Provider Adapter (to call LLMs), Message Router, Redis (streaming pub/sub), Postgres (persistence).

---

### 2. Agent Service

Manages agent definitions and their runtime configuration. **Admin/developer-only** — end users never interact with agent CRUD; they only see published agents in the chat picker.

**Responsibilities:**
- CRUD for agent definitions (system prompt, model, params, tools, knowledge) — restricted to admin/developer roles
- Version management (immutable snapshots, rollback)
- Publish workflow: `draft` → `published` → `archived`. Only published agents are exposed to end users
- Resolve an agent's full config at runtime (model + prompt + tools + knowledge)
- Agent testing playground (ephemeral conversations for admin/developer)

**Key interfaces:**
```
AgentService
  ├── createAgent(workspaceId, definition)         # admin/developer only
  ├── updateAgent(agentId, patch) → new version    # admin/developer only
  ├── publishAgent(agentId, version)               # admin/developer only
  ├── getAgent(agentId, version?)
  ├── listPublishedAgents(workspaceId) → Agent[]   # end-user facing (chat picker)
  ├── resolveRuntime(agentId) → { model, prompt, tools[], knowledge[] }
  └── deleteAgent(agentId)                         # admin/developer only
```

**Dependencies:** Postgres, Provider Adapter (to validate model exists).

---

### 3. Message Router

The central orchestrator that decides how to handle an incoming user message.

**Responsibilities:**
- Determine routing target: direct LLM call vs. agent vs. multi-agent pipeline (v2)
- Build the full prompt context (system prompt, conversation history, injected knowledge)
- Apply token budget and truncation strategy
- Dispatch to Provider Adapter and stream response back to Chat Service
- Handle tool-call loops (agent sends tool_call → execute → feed result → continue)
- Retry / fallback on provider errors

**Key interfaces:**
```
MessageRouter
  ├── route(conversationId, userMessage) → Observable<token>
  ├── buildContext(conversation, agent?) → PromptContext
  ├── executeToolCall(toolCall) → ToolResult
  └── applyFallback(primaryProvider, error) → FallbackProvider
```

**Dependencies:** Chat Service, Agent Service, Provider Adapter, Tool Executor (v2).

---

### 4. Provider Adapter

An abstraction layer that normalizes all LLM providers behind a single interface. All providers are accessed through an **OpenAI-compatible adapter pattern**.

**Responsibilities:**
- Unified `complete(messages, options)` interface across all providers
- Translate provider-specific request/response formats
- Handle streaming (SSE / chunked transfer) uniformly
- Manage API keys, base URLs, and auth per provider instance
- Token counting (tiktoken for OpenAI-family, provider-specific for others)
- Rate limiting, retry with exponential backoff, circuit breaker
- Health checks and availability reporting

**Adapter hierarchy:**
```
ProviderAdapter (abstract)
  ├── OpenAIAdapter          — GPT-4o, GPT-4, GPT-3.5, o1, o3, etc.
  ├── AnthropicAdapter       — Claude 4, 3.5, etc. (maps to OpenAI-compat format)
  ├── GoogleGeminiAdapter    — Gemini Pro, Flash, Ultra
  ├── OllamaAdapter          — Local models (Llama, Mistral, Phi, etc.)
  └── CustomOpenAIAdapter    — Any OpenAI-compatible endpoint (vLLM, LiteLLM, etc.)
```

**Key interfaces:**
```
ProviderAdapter
  ├── complete(messages, options) → Observable<CompletionChunk>
  ├── listModels() → Model[]
  ├── countTokens(messages) → number
  ├── healthCheck() → ProviderStatus
  └── getUsage() → UsageStats
```

**Dependencies:** Redis (rate-limit state), Postgres (provider config, usage records).

---

### 5. Workspace & Team Management (v2 — schema-ready in v1)

Multi-tenancy primitives that scope all resources to a workspace.

> **v1 approach:** A single implicit default workspace is auto-created on first boot. All users, agents, conversations, and providers belong to this workspace. The `workspaceId` foreign key exists in the schema from day one so that enabling multi-tenancy in v2 requires no data migration — only adding the Workspace CRUD UI and invitation flow.

**Responsibilities (v2):**
- Workspace CRUD (name, slug, settings, billing plan reference)
- Invite / remove members, assign workspace-level roles
- Scope all resources (conversations, agents, providers, knowledge) to a workspace
- Workspace-level settings: default model, rate limits, allowed providers
- API key management per workspace

**Key interfaces (v2):**
```
WorkspaceService
  ├── createWorkspace(ownerId, name)
  ├── inviteMember(workspaceId, email, role)
  ├── removeMember(workspaceId, userId)
  ├── updateRole(workspaceId, userId, role)
  ├── getSettings(workspaceId) → WorkspaceSettings
  └── updateSettings(workspaceId, patch)
```

**Data model (present in v1 schema, single default workspace):**
```
Workspace  1 ─── * WorkspaceMember (userId, role, joinedAt)
Workspace  1 ─── * Conversation
Workspace  1 ─── * Agent
Workspace  1 ─── * ProviderConfig
```

**Dependencies:** Postgres, Auth Module (RBAC policy evaluation).

---

### 6. Audit & Logging

Cross-cutting concern that records every significant action for compliance and debugging.

**Responsibilities:**
- Capture audit events: who, what, when, on which resource, from which IP
- Async writes via Redis queue (BullMQ) to avoid latency on hot paths
- Queryable audit log in Postgres (admin dashboard + API)
- Retention policies (auto-archive or delete after N days)
- Structured application logging (JSON) shipped to observability stack
- Security events: failed logins, permission denials, API key usage

**Event schema:**
```
AuditEvent {
  id:          uuid
  timestamp:   ISO-8601
  actor:       { userId, ip, userAgent }
  action:      string          // e.g. "conversation.create", "agent.update", "user.login"
  resource:    { type, id }    // e.g. { type: "agent", id: "ag_abc123" }
  workspace:   workspaceId
  metadata:    JSON             // action-specific payload (diff, old/new values)
  status:      "success" | "failure"
}
```

**Dependencies:** Redis/BullMQ (async write queue), Postgres (storage), OpenTelemetry (trace correlation).

---

## Data Flow — Sending a Chat Message

```
User types message in Next.js UI
        │
        ▼
[1] POST /api/v1/conversations/:id/messages
    → NestJS Auth Guard validates JWT
    → RBAC guard checks permission
        │
        ▼
[2] Chat Service persists user message in Postgres
    → Emits audit event (async, via Redis queue)
        │
        ▼
[3] Chat Service calls Message Router
    → Router resolves agent config (if agent conversation)
    → Router builds prompt context (system prompt + history + knowledge)
    → Router applies token budget / truncation
        │
        ▼
[4] Message Router calls Provider Adapter
    → Adapter translates to provider-specific API format
    → Adapter opens streaming connection to LLM provider
        │
        ▼
[5] Tokens stream back:
    Provider → Adapter → Router → Chat Service → SSE → UI
    (each token pushed through the pipeline in real time via text/event-stream)
        │
        ▼
[6] On stream completion:
    → Chat Service persists full assistant message (role: ASSISTANT, contentType: TEXT)
    → Chat Service persists reasoning blocks (contentType: THINKING) as child rows
    → Chat Service persists tool calls / results (role: TOOL, contentType: TOOL_CALL / TOOL_RESULT) as child rows
    → Chat Service records token usage
    → Emits audit event + analytics event (async)
        │
        ▼
[7] If assistant response contains tool_calls (agent mode):
    → Router executes tool → feeds result back → goto [4]
```

---

## Project Structure

```
centrai-chat/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── app/                      # App Router pages & layouts
│   │   │   ├── (auth)/               # Login, register, password reset
│   │   │   ├── (dashboard)/          # End-user app shell
│   │   │   │   ├── chat/             # Chat UI (agent/model picker, message thread)
│   │   │   │   └── settings/         # User profile & preferences
│   │   │   ├── (admin)/              # Admin-only shell (RBAC-gated)
│   │   │   │   ├── agents/           # Agent CRUD, versioning, publish
│   │   │   │   ├── providers/        # Provider config, API keys, models
│   │   │   │   ├── users/            # User management, role assignment
│   │   │   │   ├── analytics/        # Usage stats, token consumption
│   │   │   │   ├── audit/            # Audit log viewer
│   │   │   │   └── settings/         # System-wide settings, feature flags
│   │   │   └── api/                  # Next.js API routes (BFF proxy)
│   │   ├── components/               # Shared React components
│   │   │   ├── chat/                 # MessageBubble, ChatInput, StreamRenderer
│   │   │   ├── admin/                # AgentForm, ProviderForm, UserTable
│   │   │   ├── layout/               # Sidebar, Header, Navigation
│   │   │   └── ui/                   # Primitives (re-exports @centrai/ui)
│   │   ├── hooks/                    # React hooks (useChat, useAuth)
│   │   ├── lib/                      # Client utilities, API client
│   │   └── styles/                   # Global styles, Tailwind config
│   │
│   ├── api/                          # NestJS backend (HTTP + SSE streaming)
│   │   ├── src/
│   │   │   ├── auth/                 # Auth module (guards, strategies, JWT)
│   │   │   ├── chat/                 # Chat module (service, controller, SSE streaming)
│   │   │   ├── agent/                # Agent module (service, controller)
│   │   │   ├── provider/             # Provider adapter module
│   │   │   ├── router/               # Message router / orchestrator
│   │   │   ├── workspace/            # Workspace module (v2 — single default in v1)
│   │   │   ├── admin/                # Admin module (analytics, user mgmt)
│   │   │   ├── audit/                # Audit logging module
│   │   │   ├── common/               # Shared guards, interceptors, filters, DTOs
│   │   │   └── config/               # Environment config, validation schemas
│   │   ├── prisma/                   # Prisma schema & migrations
│   │   └── test/                     # E2E & integration tests
│   │
│   └── worker/                       # Background job processor (separate process)
│       ├── src/
│       │   ├── jobs/                 # Job handlers
│       │   │   ├── llm-completion.job.ts
│       │   │   ├── embedding.job.ts
│       │   │   ├── webhook-delivery.job.ts
│       │   │   └── audit-write.job.ts
│       │   ├── queues/               # BullMQ queue definitions & config
│       │   └── main.ts               # Worker bootstrap
│       └── package.json
│
├── packages/                         # Shared packages (monorepo)
│   ├── ui/                           # Design system & React component library
│   │   ├── src/
│   │   │   ├── primitives/           # Button, Input, Dialog, Toast, etc. (shadcn/ui)
│   │   │   ├── compositions/         # Higher-level composed components
│   │   │   └── theme/                # Theme tokens, CSS variables, dark/light
│   │   └── package.json              # @centrai/ui
│   │
│   ├── sdk/                          # TypeScript SDK for the CentrAI API
│   │   ├── src/
│   │   │   ├── client.ts             # HTTP client wrapper
│   │   │   ├── resources/            # Typed resource classes (chat, agents, providers)
│   │   │   └── streaming.ts          # SSE streaming helpers
│   │   └── package.json              # @centrai/sdk
│   │
│   ├── config/                       # Shared config & tooling presets
│   │   ├── eslint/                   # ESLint flat config presets
│   │   ├── tsconfig/                 # Base tsconfig files
│   │   ├── prettier/                 # Prettier config
│   │   └── package.json              # @centrai/config
│   │
│   └── types/                        # Shared TypeScript types & Zod schemas
│       ├── src/
│       │   ├── api.ts                # Request/response DTOs
│       │   ├── models.ts             # Domain entities (User, Agent, Conversation…)
│       │   ├── events.ts             # SSE & queue event payloads
│       │   └── index.ts              # Barrel export
│       └── package.json              # @centrai/types
│
├── docs/                             # Project documentation
│   ├── SCOPE.md                      # Platform scopes & feature breakdown
│   ├── ARCHITECTURE.md               # This file
│   └── MVP.md                        # MVP phase plan & milestones
│
├── examples/                         # Usage examples & quickstarts
│   ├── sdk-basic/                    # Minimal SDK usage (Node.js script)
│   ├── custom-agent/                 # Create & chat with a custom agent
│   ├── provider-setup/               # Add a new LLM provider via API
│   └── docker-selfhost/              # One-command self-host walkthrough
│
├── scripts/                          # Dev & ops scripts
│   ├── setup.sh                      # First-time project setup (install, env, db)
│   ├── seed.ts                       # Seed DB with sample data (users, agents)
│   ├── migrate.sh                    # Run Prisma migrations
│   └── release.sh                    # Tag, build images, push to registry
│
├── docker/                           # Docker & compose files
│   ├── docker-compose.yml            # Full stack local dev
│   ├── docker-compose.prod.yml       # Production overrides
│   ├── Dockerfile.web                # Next.js image
│   ├── Dockerfile.api                # NestJS API image
│   └── Dockerfile.worker             # Worker image (shares api base)
│
├── turbo.json                        # Turborepo pipeline config
├── package.json                      # Root package.json (pnpm workspaces)
├── pnpm-workspace.yaml               # Workspace definitions
└── .github/
    └── workflows/                    # CI/CD pipelines
        ├── ci.yml                    # Lint → test → build on every PR
        └── deploy.yml                # Build images → push → deploy
```

---

## Deployment Topology

### Phase 1 — Docker Compose (v1)

Single-host deployment for development and small teams.

```
docker-compose.yml
  ├── web          (Next.js,          port 3000)
  ├── api          (NestJS API + SSE,  port 4000)
  ├── worker       (apps/worker,      BullMQ consumer — own image)
  ├── postgres     (port 5432,        persistent volume)
  ├── redis        (port 6379,        queue + cache + pub/sub)
  └── minio        (S3-compatible,    port 9000)
```

### Phase 2 — Kubernetes (v2+)

Horizontal scaling, zero-downtime deploys, auto-scaling workers.

```
k8s/
  ├── Deployment: web          (2+ replicas, HPA)
  ├── Deployment: api          (2+ replicas, HPA)
  ├── Deployment: worker       (auto-scaled on queue depth)
  ├── StatefulSet: postgres    (or managed: RDS / Cloud SQL)
  ├── Deployment: redis        (or managed: ElastiCache / Memorystore)
  ├── Ingress                  (TLS termination, routing)
  └── Helm chart               (parameterized for any environment)
```

---

## Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| **Monorepo** | Turborepo with npm/pnpm workspaces | Share types, configs, and lint rules between frontend and backend without publishing packages. |
| **OpenAI-compatible adapter** | All providers normalized to OpenAI chat format | Most providers already offer OpenAI-compatible endpoints; minimizes adapter code and makes adding new providers trivial. |
| **Async job processing** | BullMQ on Redis | LLM calls can be long-running; offloading to workers keeps API response times fast and enables retry/DLQ. |
| **Auth as pluggable module** | Interface-based, swap Auth.js / Clerk / Keycloak | Teams have strong opinions on auth; making it pluggable avoids lock-in and supports self-hosted (Keycloak) and managed (Clerk) options. |
| **Workspace-scoped schema** | All entities have a `workspaceId` FK; v1 uses a single default workspace | Schema is multi-tenancy-ready from day one; enabling workspaces in v2 requires no data migration. |
| **SSE for streaming** | HTTP `text/event-stream` | Same protocol LLM providers use natively; zero additional dependencies; works through all HTTP proxies and load balancers without sticky sessions. WebSocket can be added alongside SSE in v2 if bidirectional features (presence, collaborative editing) are needed. |
| **Prisma ORM** | Type-safe, declarative schema, migration history | Strong TypeScript integration; schema-as-code makes DB changes reviewable in PRs. |
