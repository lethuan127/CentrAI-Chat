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
│   ├── api/          # NestJS backend (port 4000)
│   └── web/          # Next.js frontend (port 3000)
├── packages/
│   ├── config/       # Shared tsconfig, prettier presets
│   └── types/        # Shared TypeScript types + Zod schemas
├── docs/             # Architecture, scope, MVP plan
├── turbo.json        # Turborepo pipeline config
└── pnpm-workspace.yaml
```

## API Endpoints (Phase 1 — Auth)

| Method | Endpoint                   | Auth     | Description                    |
| ------ | -------------------------- | -------- | ------------------------------ |
| POST   | `/api/v1/auth/register`    | Public   | Register with email + password |
| POST   | `/api/v1/auth/login`       | Public   | Login, returns JWT tokens      |
| POST   | `/api/v1/auth/refresh`     | Public   | Refresh access token           |
| POST   | `/api/v1/auth/logout`      | Bearer   | Revoke refresh tokens          |
| GET    | `/api/v1/auth/me`          | Bearer   | Get current user profile       |
| GET    | `/api/v1/auth/google`      | Public   | Initiate Google OAuth          |
| GET    | `/api/v1/auth/github`      | Public   | Initiate GitHub OAuth          |
| GET    | `/api/v1/health`           | Public   | Liveness check                 |
| GET    | `/api/v1/health/ready`     | Public   | Readiness check (DB)           |

## Documentation

- [Scope & Features](docs/SCOPE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [MVP Phase Plan](docs/MVP.md)
