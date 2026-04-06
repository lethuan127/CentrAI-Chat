# SDK Basic Examples

Demonstrates how to use the `@centrai/sdk` to interact with a running CentrAI-Chat instance.

## Prerequisites

1. A running CentrAI-Chat instance (see [Docker Self-Host](../docker-selfhost/README.md))
2. An admin account (created during first-time setup)

## Setup

From the monorepo root:

```bash
pnpm install
```

## Running

```bash
# 1. Register & log in, then inspect the profile
pnpm --filter centrai-sdk-basic-example auth

# 2. Create an agent, publish it, list published agents
pnpm --filter centrai-sdk-basic-example agents

# 3. Send a chat message and stream the response
pnpm --filter centrai-sdk-basic-example chat
```

## Configuration

Each example reads from environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CENTRAI_URL` | `http://localhost:4000` | API base URL |
| `CENTRAI_EMAIL` | `admin@example.com` | Login email |
| `CENTRAI_PASSWORD` | `Admin123!` | Login password |
