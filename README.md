# CentrAI-Chat

Open-source centralized AI conversation platform. Admins configure providers and publish agents; end users sign in, chat with a published agent or enabled model, and review their conversation history.

## Tech Stack

- **Frontend** — Next.js 15 (App Router), Tailwind CSS 4, React 19
- **Backend** — NestJS 11, Prisma 6, PostgreSQL
- **Auth** — JWT (access + refresh), Passport.js (local, Google, GitHub)
- **Monorepo** — Turborepo + pnpm workspaces

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- PostgreSQL 15+

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file and fill in your values
cp .env.example .env

# 3. Generate Prisma client
pnpm db:generate

# 4. Run database migrations
pnpm db:migrate

# 5. Seed default workspace + admin user
pnpm db:seed

# 6. Start development servers
pnpm dev
```

### Default Admin Credentials

After seeding, log in with:

- **Email:** `admin@centrai.local`
- **Password:** `Admin123!`

## Project Structure

```
centrai-chat/
├── apps/
│   ├── web/          # Next.js frontend (port 3000)
│   ├── api/          # NestJS backend (port 4000)
│   ├── worker/       # BullMQ job processor
│   └── docs/         # Documentation site (Fumadocs, port 3100)
├── packages/
│   ├── types/        # Shared TypeScript types + Zod schemas
│   ├── sdk/          # TypeScript SDK for the API
│   └── config/       # Shared tsconfig, prettier presets
├── examples/
│   ├── sdk-basic/    # SDK usage examples
│   └── docker-selfhost/  # Self-host guide
├── docs/             # Source docs + Bruno API collection
├── docker/           # Docker Compose files
├── scripts/          # Dev & ops scripts
├── turbo.json        # Turborepo pipeline config
└── pnpm-workspace.yaml
```

## Documentation

| Resource | URL |
|----------|-----|
| Documentation site | http://localhost:3100 (run `pnpm dev`) |
| Swagger UI | http://localhost:4000/api/docs |
| OpenAPI JSON | http://localhost:4000/api/docs-json |

Start the documentation site:

```bash
pnpm --filter @centrai/docs dev
```

Source docs:

- [Scope & Features](docs/SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MVP Phase Plan](docs/MVP.md)
