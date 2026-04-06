# CentrAI-Chat — MVP Phase Plan

> Goal: ship a self-hostable platform where **admins** configure providers and publish agents, and **end users** sign in, chat with a published agent or enabled model, and review their conversation history — all deployable with a single `docker compose up`.

---

## MVP Milestone Map

```
 ADMIN TRACK                          END-USER TRACK
─────────────                         ────────────────
Phase 1: Auth (all roles) ─────────────────────────────────────┐
     │                                                         │
     ├──→ Phase 2: Agent CRUD (admin)                          │
     │         │                                               │
     │         └──→ Phase 3: Chat + Stream (end user) ←────────┘
     │                   │
     │                   └──→ Phase 4: Conversation History (end user)
     │
     ├──→ Phase 5: Model Providers (admin)
     │         │
     │         └──→ (feeds models into Phase 3 chat picker)
     │
     └──→ Phase 6: Admin Dashboard (admin)

Phase 7: Docker Self-Host (ops) ── packages everything above
Phase 8: API Docs (developer) ──── documents everything above
```

Phases can overlap where there are no dependency arrows (e.g. 3+4 in parallel, 5+6 in parallel).

---

## Phase 1 — Authentication

**Goal:** Users can register, log in, and access protected routes. RBAC gates all subsequent features.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 1.1 | Auth module scaffold | `apps/api` | NestJS module with guards, strategies, decorators. |
| 1.2 | Prisma User model | `apps/api` | `User { id, email, passwordHash, name, avatar, role, createdAt, updatedAt }`. |
| 1.3 | Email/password registration | `apps/api` | `POST /api/v1/auth/register` — hash with argon2, return tokens. |
| 1.4 | Email/password login | `apps/api` | `POST /api/v1/auth/login` — validate credentials, return JWT access + refresh tokens. |
| 1.5 | JWT strategy | `apps/api` | Access token (15 min) + refresh token (7 days). `POST /api/v1/auth/refresh`. |
| 1.6 | OAuth 2.0 (Google, GitHub) | `apps/api` | Passport strategies; auto-create user on first OAuth login. |
| 1.7 | RBAC guard | `apps/api` | `@Roles(...)` decorator + guard. Roles: `admin`, `developer`, `user`. Permission check on every protected route. |
| 1.8 | Auth pages | `apps/web` | Login, register, forgot-password pages. Responsive, dark/light. |
| 1.9 | Auth context & hooks | `apps/web` | `useAuth()` hook, token storage, auto-refresh, redirect on 401. Exposes `user.role` for UI gating. |
| 1.10 | Protected layouts | `apps/web` | `(dashboard)` for end users, `(admin)` for admin/developer. Unauthenticated → login. Non-admin accessing `/admin/*` → 403. |

### Acceptance Criteria

- [ ] User can register with email/password and receive JWT tokens
- [ ] User can log in and access the chat dashboard
- [ ] OAuth sign-in works for Google and GitHub
- [ ] Expired tokens auto-refresh; invalid tokens redirect to login
- [ ] Three roles enforced: `admin` (full access), `developer` (agent CRUD + chat), `user` (chat only)
- [ ] Admin routes reject `developer` and `user` roles with 403
- [ ] `(admin)` layout is only accessible to `admin` / `developer` roles
- [ ] Passwords are hashed (argon2); no plaintext stored

---

## Phase 2 — Create & Manage Agents (Admin Only)

**Goal:** Admins and developers can create, edit, version, publish, and delete agent definitions. End users never access this UI — they only see published agents in the chat picker.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 2.1 | Prisma Agent model | `apps/api` | `Agent { id, name, description, systemPrompt, modelId, providerId, temperature, maxTokens, tags[], status(draft/published/archived), version, createdBy, createdAt, updatedAt }`. |
| 2.2 | Agent CRUD endpoints | `apps/api` | `POST/GET/PATCH/DELETE /api/v1/agents` — admin/developer role required. |
| 2.3 | Agent publish endpoint | `apps/api` | `POST /api/v1/agents/:id/publish` — transitions status from `draft` → `published`. Only published agents appear in end-user chat picker. |
| 2.4 | Agent versioning | `apps/api` | `AgentVersion` table. Each update creates a new version; `GET /agents/:id?version=N`. |
| 2.5 | Agent validation | `apps/api` | Zod schemas in `@centrai/types` for create/update DTOs. Validate model exists. |
| 2.6 | Published agents endpoint | `apps/api` | `GET /api/v1/agents/published` — public endpoint for end users (chat picker). Returns only `status=published` agents with limited fields (no system prompt internals). |
| 2.7 | Agent list page (admin) | `apps/web` | Under `(admin)/agents/` — card grid with search, tag filter, status badge (draft/published/archived). |
| 2.8 | Agent create/edit form (admin) | `apps/web` | Multi-step form: name, prompt, model picker, params, tags. Publish button. |
| 2.9 | Agent detail page (admin) | `apps/web` | View full config, version history, usage stats placeholder. |
| 2.10 | Agent types | `packages/types` | `Agent`, `AgentVersion`, `AgentStatus`, `CreateAgentDto`, `UpdateAgentDto`, `PublishedAgentDto` types. |

### Acceptance Criteria

- [ ] Admin/developer can create an agent with name, system prompt, and model
- [ ] Agent list (admin UI) displays all agents with search, filter, and status
- [ ] Publishing an agent makes it visible in the end-user chat picker
- [ ] Unpublished (draft) agents are invisible to end users
- [ ] Editing an agent creates a new version (old versions are immutable)
- [ ] Deleting an agent soft-deletes; recoverable by admin
- [ ] End users hitting agent CRUD endpoints receive 403

---

## Phase 3 — Chat with One Agent (End-User Facing)

**Goal:** An end user can pick a published agent (or an admin-enabled model) and have a streamed conversation in real time.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 3.1 | Prisma Conversation & Message models | `apps/api` | `Conversation { id, title, userId, agentId, modelId, providerId, createdAt, updatedAt }`, `Message { id, conversationId, role, content, tokenCount, createdAt }`. |
| 3.2 | Chat service | `apps/api` | Create conversation, append message, retrieve messages with pagination. |
| 3.3 | Message router | `apps/api` | Resolve agent config → build prompt context → call provider adapter → stream tokens. End user never sees the system prompt or agent internals. |
| 3.4 | SSE streaming endpoint | `apps/api` | `POST /api/v1/chat/messages` returns `text/event-stream` with `token` / `done` / `error` / `stopped` events. `POST /api/v1/chat/messages/:id/stop` cancels an active stream. Auth via Bearer token. |
| 3.5 | Chat page | `apps/web` | Full-screen chat UI under `(dashboard)/chat/`: message list, input bar, streaming token rendering. |
| 3.6 | Agent/model picker | `apps/web` | Dropdown showing **only published agents** and **admin-enabled models**. Grouped by category. No agent config details exposed. |
| 3.7 | Markdown renderer | `apps/web` | Render assistant messages with Markdown, syntax-highlighted code blocks, LaTeX. |
| 3.8 | Chat hooks | `apps/web` | `useChat()` — sends messages via `fetch` POST, reads SSE response stream via `ReadableStream`, manages message state and streaming buffer. |
| 3.9 | Auto-title generation | `apps/worker` | BullMQ job: after first assistant reply, call LLM to generate a conversation title. |

### Acceptance Criteria

- [ ] End user can start a new conversation by picking a published agent or enabled model
- [ ] Only published agents and admin-enabled models appear in the picker
- [ ] Messages stream token-by-token to the UI in real time
- [ ] Conversation is persisted; refreshing the page restores the full thread
- [ ] Markdown and code blocks render correctly in assistant messages
- [ ] Error states are handled gracefully (provider down, rate limit, timeout)
- [ ] Conversation title is auto-generated after the first exchange

---

## Phase 4 — Conversation History

**Goal:** Users can browse, search, and manage their past conversations.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 4.1 | Conversation list endpoint | `apps/api` | `GET /api/v1/conversations` — paginated, filterable by agent/model/date. Full-text search via Postgres `tsvector`. |
| 4.2 | Conversation detail endpoint | `apps/api` | `GET /api/v1/conversations/:id/messages` — paginated messages. |
| 4.3 | Soft delete & archive | `apps/api` | `DELETE /api/v1/conversations/:id` sets `deletedAt`. `PATCH .../archive`. |
| 4.4 | Export endpoint | `apps/api` | `GET /api/v1/conversations/:id/export?format=json|md` — returns downloadable file. |
| 4.5 | Sidebar conversation list | `apps/web` | Grouped by date (Today, Yesterday, Previous 7 days, Older). Search input. |
| 4.6 | Conversation actions | `apps/web` | Rename, archive, delete, export — via context menu on each conversation. |
| 4.7 | Empty & loading states | `apps/web` | Skeleton loaders, empty state illustration, error boundaries. |

### Acceptance Criteria

- [ ] Sidebar lists all user conversations, most recent first
- [ ] Search finds conversations by title or message content
- [ ] User can rename, archive, delete, and export a conversation
- [ ] Deleted conversations are hidden but recoverable by admin
- [ ] Pagination loads smoothly on scroll (infinite scroll or "load more")

---

## Phase 5 — Multiple Model Providers

**Goal:** Admins configure and enable LLM providers via the admin UI; end users see only the models that admins have enabled in the chat picker.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 5.1 | Provider adapter abstraction | `apps/api` | `ProviderAdapter` interface: `complete()`, `listModels()`, `countTokens()`, `healthCheck()`. |
| 5.2 | OpenAI adapter | `apps/api` | GPT-4o, GPT-4, GPT-3.5, o-series. Streaming via SSE. |
| 5.3 | Anthropic adapter | `apps/api` | Claude 4, 3.5 Sonnet/Haiku. Map to common interface. |
| 5.4 | Google Gemini adapter | `apps/api` | Gemini Pro, Flash. Map to common interface. |
| 5.5 | Ollama adapter | `apps/api` | Local models. Auto-discover via `GET /api/tags`. |
| 5.6 | Custom OpenAI-compatible adapter | `apps/api` | Any endpoint that speaks the OpenAI API (vLLM, LiteLLM, Together, etc.). |
| 5.7 | Prisma Provider & Model models | `apps/api` | `Provider { id, name, type, baseUrl, apiKey(encrypted), enabled }`, `Model { id, providerId, name, contextWindow, capabilities }`. |
| 5.8 | Provider management endpoints | `apps/api` | `POST/GET/PATCH/DELETE /api/v1/providers`. Admin-only. |
| 5.9 | Provider settings UI (admin) | `apps/web` | Under `(admin)/providers/`: add provider, enter API key, test connection, enable/disable models. |
| 5.10 | Model selector in chat | `apps/web` | End-user chat picker shows only admin-enabled models, grouped by provider. |
| 5.11 | Token usage tracking | `apps/api` | Record prompt/completion tokens per message. Aggregate per conversation. |
| 5.12 | Retry & fallback | `apps/api` | Configurable retry (exponential backoff). Optional fallback provider on failure. |

### Acceptance Criteria

- [ ] Admin can add OpenAI, Anthropic, Gemini, and Ollama providers via UI
- [ ] "Test connection" validates API key and lists available models
- [ ] Users see all enabled models in the chat model selector
- [ ] Streaming works consistently across all provider types
- [ ] API keys are encrypted at rest (AES-256 or similar)
- [ ] Token usage is recorded and visible in conversation metadata

---

## Phase 6 — Basic Admin UI

**Goal:** Admins can manage users, view usage analytics, and monitor system health from a dashboard.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 6.1 | Admin layout (complete) | `apps/web` | Expand the `(admin)/` shell (created in Phase 1, agents section added in Phase 2) with full sidebar: Users, Agents, Providers, Analytics, Audit Log, Settings. |
| 6.2 | User management page | `apps/web` | Table: name, email, role, status, joined date. Actions: invite, deactivate, change role. |
| 6.3 | User management endpoints | `apps/api` | `GET /api/v1/admin/users`, `PATCH /api/v1/admin/users/:id` (role, status). |
| 6.4 | Usage analytics page | `apps/web` | Cards: total conversations, messages, tokens consumed (today / 7d / 30d). Chart: daily usage trend. |
| 6.5 | Analytics endpoints | `apps/api` | `GET /api/v1/admin/analytics/overview`, `GET /api/v1/admin/analytics/usage?range=7d`. |
| 6.6 | Provider health page | `apps/web` | Per-provider status (up/down), latency, error rate, quota usage. |
| 6.7 | Audit log page | `apps/web` | Filterable table: timestamp, actor, action, resource, status. |
| 6.8 | Audit log endpoint | `apps/api` | `GET /api/v1/admin/audit-log` with filters: actor, action, date range. |
| 6.9 | Audit event emitter | `apps/api` | Interceptor or decorator that emits audit events on key actions (async via queue). |
| 6.10 | System settings page | `apps/web` | Default model, rate limits, registration open/closed, feature flags. |

### Acceptance Criteria

- [ ] Admin dashboard is accessible to `admin` role (full access) and `developer` role (agents section only)
- [ ] `user` role is redirected or sees 403 when accessing any `/admin/*` route
- [ ] User list shows all users with working role-change and deactivation (admin only)
- [ ] Analytics cards display accurate counts; chart updates with date range
- [ ] Audit log records login, agent CRUD, provider changes, and user management actions

---

## Phase 7 — Docker Self-Host Setup

**Goal:** Anyone can deploy the entire platform with `docker compose up` and a single `.env` file.

### Deliverables

| # | Task | Location | Details |
|---|---|---|---|
| 7.1 | Dockerfile.web | `docker/` | Multi-stage build: install → build → slim runtime (node:alpine). |
| 7.2 | Dockerfile.api | `docker/` | Multi-stage build: install → build → prune to production deps. |
| 7.3 | Dockerfile.worker | `docker/` | Same base as API; different entrypoint (`apps/worker`). |
| 7.4 | docker-compose.yml | `docker/` | Services: `web`, `api`, `worker`, `postgres`, `redis`, `minio`. Health checks, dependency ordering, named volumes. |
| 7.5 | docker-compose.prod.yml | `docker/` | Production overrides: resource limits, restart policies, log drivers. |
| 7.6 | .env.example | root | Documented template: DB URL, Redis URL, JWT secret, OAuth credentials, provider API keys, MinIO config. |
| 7.7 | setup.sh script | `scripts/` | Interactive first-run: copy `.env.example` → `.env`, generate secrets, run `docker compose up -d`, run DB migrations, seed admin user. |
| 7.8 | DB migration on startup | `apps/api` | Auto-run `prisma migrate deploy` on container start (before listening). |
| 7.9 | Health check endpoints | `apps/api` | `GET /health` (liveness), `GET /ready` (readiness — checks DB + Redis connectivity). |
| 7.10 | Self-host example | `examples/` | `examples/docker-selfhost/README.md` — step-by-step guide: prerequisites, clone, configure, deploy, verify. |

### Acceptance Criteria

- [ ] `docker compose up` starts all services with zero manual steps beyond `.env`
- [ ] First-time setup creates DB schema and seeds an admin user
- [ ] All services pass health checks within 60 seconds of startup
- [ ] Platform is usable at `http://localhost:3000` after compose up
- [ ] `docker compose down -v` cleanly tears down everything
- [ ] `.env.example` documents every required and optional variable

---

## Phase 8 — API Documentation

**Goal:** Every public endpoint is documented with an interactive Swagger UI and a downloadable OpenAPI spec.

### Deliverables

| # | Task | App | Details |
|---|---|---|---|
| 8.1 | Swagger module setup | `apps/api` | `@nestjs/swagger` configured with title, version, bearer auth. |
| 8.2 | Request/response schemas | `apps/api` | Zod DTOs (`@centrai/types`) converted to OpenAPI via `zod-to-json-schema`; `@ApiBody` / `@ApiResponse` on controllers. |
| 8.3 | Controller decorators | `apps/api` | `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()` on every controller method. |
| 8.4 | Swagger UI route | `apps/api` | Serve interactive docs at `GET /api/docs` (disabled in production by env flag). |
| 8.5 | OpenAPI JSON export | `apps/api` | `GET /api/docs-json` — downloadable spec for SDK generation and Postman import. |
| 8.6 | TypeScript SDK | `packages/sdk` | Hand-written `@centrai/sdk` aligned with the REST API and response envelope; OpenAPI spec remains the contract for other generators. |
| 8.7 | API usage examples | `examples/` | `examples/sdk-basic/` — Node.js script demonstrating auth, create agent, send message. |
| 8.8 | Postman / Bruno collection | `docs/bruno/` | Bruno collection with local and staging environments. |
| 8.9 | Documentation site | `apps/docs/` | Fumadocs (Next.js): guides, architecture summary, API overview; content in `content/docs` (MDX). |

### Acceptance Criteria

- [x] Swagger UI at `/api/docs` documents every endpoint with request/response schemas
- [x] "Try it out" works in Swagger UI with a valid JWT token
- [ ] OpenAPI spec validates with no errors (`swagger-cli validate` — run locally against `/api/docs-json`)
- [x] `@centrai/sdk` implements the public API (hand-maintained; OpenAPI spec is the source for third-party codegen)
- [x] Examples in `examples/sdk-basic/` target a local deployment (see example README)

---

## MVP Summary

| Phase | Module | Persona | Key Outcome | Est. Effort |
|---|---|---|---|---|
| 1 | Authentication | All | Register, log in (email + OAuth), RBAC enforced | M |
| 2 | Agent Registry | Admin | CRUD agents, versioning, publish workflow | S |
| 3 | Chat | End User | Stream chat with published agent or enabled model | L |
| 4 | Conversation History | End User | Browse, search, export past conversations | M |
| 5 | Model Providers | Admin | OpenAI, Anthropic, Gemini, Ollama adapters; admin config | L |
| 6 | Admin Dashboard | Admin | User mgmt, analytics, audit log, system settings | M |
| 7 | Docker Self-Host | Ops | One-command deployment with compose; `.env`-driven | M |
| 8 | API Docs | Developer | Swagger UI, OpenAPI spec, SDK generation, examples | S |

**T-shirt sizes:** S = ~1 week, M = ~2 weeks, L = ~3 weeks (solo developer pace).

**Total estimated MVP timeline:** ~14–16 weeks (solo) / ~6–8 weeks (2–3 person team).

---

## Post-MVP (v2 Roadmap Preview)

Once the MVP is stable and deployed, the following features unlock:

| Feature | Builds On |
|---|---|
| Multi-agent orchestration | Phase 3 (Chat) + Phase 2 (Agents) |
| MCP server integration | Phase 2 (Agents) + Phase 5 (Providers) |
| Knowledge base / RAG | Phase 2 (Agents) + new embedding pipeline |
| Tool builder | Phase 2 (Agents) |
| Workspace / multi-tenancy | Phase 1 (Auth) + Phase 6 (Admin) |
| Billing & usage quotas | Phase 5 (Providers) + Phase 6 (Admin) |
