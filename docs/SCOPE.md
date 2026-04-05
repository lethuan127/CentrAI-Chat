# CentrAI-Chat — Project Scope

## Vision

CentrAI-Chat is an open-source, centralized AI conversation platform. **End users** chat with published agents and enabled LLM models from a single interface. **Admins and developers** configure providers, build and publish agents, and manage knowledge bases, tools, and integrations behind the scenes.

---

## Platform Scopes

### 1. Centralized AI Conversation Platform

A unified chat experience where **end users** interact with AI through agents or models that **admins** have configured and published.

| Capability | Description |
|---|---|
| **LLM Provider Chat** | Direct conversations with admin-enabled models from OpenAI, Anthropic, Google, Mistral, local/self-hosted models, etc. End users pick from available models and chat. |
| **Agent Chat** | Conversations with admin-configured agents that wrap a model with system prompts, tools, and knowledge bases. End users select a published agent and chat — they never see or edit agent internals. |
| **Multi-Agent Chat** | Orchestrated conversations where multiple agents collaborate, debate, or hand off within a single thread (routing, sequential, parallel patterns). |

**User personas:**

| Persona | What they do | What they don't do |
|---|---|---|
| **End User** | Chat with published agents or enabled models, manage their own conversations, export history. | Create/edit/delete agents, configure providers, access admin UI. |
| **Admin / Developer** | Create and configure agents, manage model providers, manage users, view analytics and audit logs. | — (superset of end-user capabilities) |

**End-user flows:**
- Start a new conversation → pick from published agents or enabled models → chat
- View and search conversation history
- Attach files, images, or structured context to messages
- Export or share conversations

**Admin flows:**
- Configure model providers (API keys, base URLs, enable/disable models)
- Create, edit, version, and publish agents
- Manage users and roles
- Monitor usage analytics and audit logs

---

### 2. Developer / Admin Platform

A management interface for admins and developers to create and manage AI building blocks. End users never interact with this layer directly — they consume the agents and models that admins publish.

#### 2.1 Agent Builder

| Concept | Description |
|---|---|
| **Agent Definition** | Name, description, icon, system prompt, model binding, temperature & sampling params. |
| **Tool Binding** | Attach one or more tools (functions, APIs, MCP servers) an agent can invoke. |
| **Knowledge Binding** | Attach knowledge bases or structured knowledge so the agent can perform RAG. |
| **Guardrails** | Input/output filters, token limits, content policies. |
| **Versioning** | Immutable agent versions; rollback support. |

#### 2.2 MCP (Model Context Protocol) Integration

| Concept | Description |
|---|---|
| **MCP Server Registry** | Register external MCP servers (stdio, SSE, HTTP). |
| **MCP Tool Discovery** | Auto-discover tools exposed by an MCP server. |
| **MCP Resource Access** | Expose MCP resources as context for agents. |
| **Connection Management** | Health checks, reconnection, credential storage per server. |

#### 2.3 Knowledge Base

| Concept | Description |
|---|---|
| **Document Ingestion** | Upload files (PDF, Markdown, DOCX, TXT, HTML) and web URLs. |
| **Chunking & Embedding** | Configurable chunking strategies; pluggable embedding providers. |
| **Vector Store** | Abstraction over vector DBs (pgvector, Qdrant, Weaviate, etc.). |
| **Retrieval** | Similarity search, hybrid search (vector + keyword), reranking. |

#### 2.4 Structured Knowledge

| Concept | Description |
|---|---|
| **Schema Definition** | Define entity types, attributes, and relationships (graph or relational). |
| **Data Ingestion** | Import structured data (CSV, JSON, SQL, API). |
| **Query Interface** | Natural-language-to-query or direct API queries over structured data. |
| **Knowledge Graph** | Optional graph-based storage for relationship-heavy domains. |

#### 2.5 Tools

| Concept | Description |
|---|---|
| **Tool Definition** | Name, description, JSON Schema for parameters, execution endpoint. |
| **Built-in Tools** | Web search, code interpreter, file I/O, calculator, etc. |
| **Custom Tools** | User-defined HTTP/gRPC endpoints registered as callable tools. |
| **Tool Execution Sandbox** | Isolated execution environment for untrusted tool code. |
| **Approval Workflows** | Optional human-in-the-loop approval before tool execution. |

---

### 3. Authentication & Authorization

#### 3.1 Authentication

| Method | Description |
|---|---|
| **Base Auth** | Email/password registration and login with secure hashing (bcrypt/argon2), email verification, password reset. |
| **OAuth 2.0 / OIDC** | Sign in via Google, GitHub, Microsoft, or any OIDC-compliant provider. Support authorization code flow with PKCE. |
| **API Keys** | Long-lived keys for programmatic access (agent API, MCP, admin API). Scoped and revocable. |
| **Session Management** | JWT (access + refresh tokens) or server-side sessions. Token rotation, revocation, expiry. |

#### 3.2 Authorization (RBAC)

| Concept | Description |
|---|---|
| **Roles** | `admin`, `developer`, `user`. Extensible (e.g. `super_admin` in v2 with multi-tenancy). |
| **Permissions** | Fine-grained permissions mapped to roles (e.g., `agent:create`, `kb:read`, `conversation:delete`, `admin:manage_users`). |
| **Resource Scoping** | Permissions scoped to workspace / org / project / resource level. |
| **Policy Enforcement** | Middleware-level checks on every API request; UI hides unauthorized actions. |

**Default role matrix (v1):**

| Permission | admin | developer | user |
|---|---|---|---|
| Manage users & roles | yes | — | — |
| Manage model providers | yes | — | — |
| Create / edit / publish agents | yes | yes | — |
| Manage knowledge bases (v2) | yes | yes | — |
| Manage tools & MCP (v2) | yes | yes | — |
| View admin dashboard | yes | yes (agent section only) | — |
| System settings | yes | — | — |
| Chat with published agents | yes | yes | yes |
| Chat with enabled models | yes | yes | yes |
| Manage own conversations | yes | yes | yes |

---

## Core v1 — Feature Breakdown

The first release focuses on a functional end-to-end flow: **admins** configure providers and publish agents, **end users** sign in and chat with published agents or enabled models.

### v1.1 User Auth

- Email/password sign-up & sign-in
- OAuth 2.0 (Google, GitHub as initial providers)
- JWT-based session management (access + refresh tokens)
- Password reset flow
- RBAC enforcement on all protected routes

### v1.2 Chat UI (End-User Facing)

- Responsive web UI (desktop + mobile)
- Conversation list sidebar with search & filters
- Message thread with streaming responses
- Agent / model picker at conversation start (shows only published agents and admin-enabled models)
- Markdown rendering, syntax highlighting, LaTeX
- File & image attachment (upload to object storage)
- Conversation branching (edit & regenerate from any message)
- Dark / light theme

### v1.3 Agent Registry (Admin / Developer Only)

- CRUD for agent definitions (name, prompt, model, tools, knowledge) — admin UI only
- Agent listing with search, tags, and publish status (draft / published / archived)
- Agent versioning (create new version, pin version to conversation)
- Agent testing playground (dry-run a conversation with draft config)
- Publish workflow: only published agents are visible to end users in the chat picker

### v1.4 Conversation History

- Persistent storage of all conversations and messages
- Per-user conversation listing with pagination
- Full-text search across messages
- Conversation metadata: title, timestamps, model/agent used, token usage
- Export (JSON, Markdown)
- Soft delete & archival

### v1.5 Model Provider Integration (Admin-Configured)

- Provider adapter abstraction (common interface for all LLMs)
- Built-in adapters: OpenAI, Anthropic, Google Gemini, Ollama (local)
- Provider management UI in admin dashboard (add API key, set base URL, enable/disable)
- Model listing per provider (auto-fetch or manual config); admin controls which models end users can access
- Streaming completions via SSE (Server-Sent Events over HTTP)
- Token counting and usage tracking per conversation
- Fallback & retry logic

### v1.6 Admin Dashboard

- User management: list, invite, deactivate, assign roles
- System-wide usage analytics: conversations, messages, token consumption
- Model provider health & quota monitoring
- Agent usage statistics
- Audit log (who did what, when)
- System settings: default model, rate limits, feature flags

### v1.7 API

- RESTful API for all platform operations
- OpenAPI / Swagger spec auto-generated
- Versioned endpoints (`/api/v1/...`)
- Rate limiting per user / API key
- Webhook support for conversation events
- SDK-friendly response format (consistent envelope: `{ data, error, meta }`)

**Core resource endpoints:**

*End-user endpoints (role: `user` and above):*

| Resource | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| Profile | `GET /users/me`, `PATCH /users/me` |
| Conversations | `POST /conversations`, `GET /conversations`, `GET /conversations/:id`, `DELETE /conversations/:id` |
| Messages | `POST /conversations/:id/messages`, `GET /conversations/:id/messages` |
| Agents (read) | `GET /agents/published` — published agents for chat picker (no internals exposed) |
| Models (read) | `GET /models` — admin-enabled models grouped by provider |

*Admin / developer endpoints (role: `admin` or `developer`):*

| Resource | Endpoints |
|---|---|
| Agents (CRUD) | `POST /agents`, `GET /agents`, `GET /agents/:id`, `PATCH /agents/:id`, `DELETE /agents/:id`, `POST /agents/:id/publish` |
| Providers | `POST /providers`, `GET /providers`, `PATCH /providers/:id`, `DELETE /providers/:id` |

*Admin-only endpoints (role: `admin`):*

| Resource | Endpoints |
|---|---|
| Users | `GET /admin/users`, `PATCH /admin/users/:id`, `DELETE /admin/users/:id` |
| Analytics | `GET /admin/analytics/overview`, `GET /admin/analytics/usage` |
| Audit | `GET /admin/audit-log` |
| Settings | `GET /admin/settings`, `PATCH /admin/settings` |

---

## Out of Scope for v1 (Future)

- Multi-agent orchestration (v2)
- MCP server integration (v2)
- Knowledge base / RAG pipeline (v2)
- Structured knowledge / knowledge graph (v2)
- Custom tool builder (v2)
- Approval workflows / human-in-the-loop (v2)
- Workspace / multi-tenancy (v2)
- Billing & usage quotas (v2)
- Plugin / extension marketplace (v3)
