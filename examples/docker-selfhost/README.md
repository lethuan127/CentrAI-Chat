# CentrAI-Chat — Docker Self-Host Guide

Deploy CentrAI-Chat on any machine with Docker in under 5 minutes.

## Prerequisites

| Requirement      | Minimum Version |
|------------------|-----------------|
| Docker           | 24.0+           |
| Docker Compose   | V2 (2.20+)      |
| RAM              | 4 GB            |
| Disk             | 10 GB free      |

## Quick Start (Automated)

```bash
git clone https://github.com/lethuan127/CentrAI-Chat.git
cd CentrAI-Chat
./scripts/setup.sh
```

The setup script will:
1. Check that Docker and Compose are installed
2. Copy `.env.example` to `.env`
3. Generate secure random secrets (JWT, encryption key, DB password)
4. Optionally prompt for an OpenAI API key
5. Build and start all services
6. Wait for health checks to pass
7. Print access URLs and default credentials

## Manual Setup

### 1. Clone and configure

```bash
git clone https://github.com/lethuan127/CentrAI-Chat.git
cd CentrAI-Chat
cp .env.example .env
```

### 2. Edit `.env`

At minimum, set these values:

```bash
# Generate with: openssl rand -base64 48
JWT_SECRET="<random-string>"
JWT_REFRESH_SECRET="<another-random-string>"

# Generate with: openssl rand -hex 32
ENCRYPTION_KEY="<64-char-hex-string>"

# Optional: set a strong Postgres password
POSTGRES_PASSWORD="<strong-password>"
```

Update `DATABASE_URL` if you changed the Postgres password:

```bash
DATABASE_URL="postgresql://centrai:<your-password>@postgres:5432/centrai_chat?schema=public"
```

### 3. Build and start

```bash
docker compose -f docker/docker-compose.yml up -d --build
```

First build takes 3–8 minutes depending on your machine and network speed.

### 4. Verify

```bash
# Check all services are running
docker compose -f docker/docker-compose.yml ps

# Check API health
curl http://localhost:4000/api/v1/health

# Check readiness (DB + Redis)
curl http://localhost:4000/api/v1/health/ready
```

### 5. Access the platform

| Service         | URL                          |
|-----------------|------------------------------|
| Web UI          | http://localhost:3000         |
| API             | http://localhost:4000         |
| API Docs        | http://localhost:4000/api/docs|
| MinIO Console   | http://localhost:9001         |

Default admin credentials:
- **Email:** `admin@centrai.local`
- **Password:** `Admin123!`

> Change the default password immediately after first login.

## Architecture

```
┌─────────┐     ┌─────────┐     ┌──────────┐
│   Web   │────▶│   API   │────▶│ Postgres │
│ :3000   │     │ :4000   │     │ :5432    │
└─────────┘     └────┬────┘     └──────────┘
                     │
                ┌────┴────┐     ┌──────────┐
                │ Worker  │────▶│  Redis   │
                │         │     │  :6379   │
                └─────────┘     └──────────┘
                                ┌──────────┐
                                │  MinIO   │
                                │  :9000   │
                                └──────────┘
```

## Production Deployment

For production, use the production overrides:

```bash
docker compose \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.prod.yml \
  up -d --build
```

This adds:
- Resource limits (CPU, memory)
- `restart: always` policies
- Log rotation (json-file driver with size limits)
- Redis memory limit with LRU eviction

### Recommended production changes

1. **Use strong passwords** — the setup script generates these automatically
2. **Set up a reverse proxy** (Nginx/Traefik) with TLS termination in front of the web and API services
3. **Use an external database** — for reliability, consider managed Postgres (RDS, Cloud SQL, Supabase)
4. **Back up volumes** — `pgdata` and `miniodata` contain persistent data
5. **Monitor logs** — `docker compose -f docker/docker-compose.yml logs -f api`

## Common Operations

### View logs

```bash
# All services
docker compose -f docker/docker-compose.yml logs -f

# Single service
docker compose -f docker/docker-compose.yml logs -f api
```

### Restart a service

```bash
docker compose -f docker/docker-compose.yml restart api
```

### Update to latest version

```bash
git pull origin main
docker compose -f docker/docker-compose.yml up -d --build
```

### Run database migrations manually

```bash
docker compose -f docker/docker-compose.yml exec api \
  npx prisma migrate deploy --schema=/app/apps/api/prisma/schema.prisma
```

### Reset everything

```bash
# Stop all containers and delete volumes (DATA LOSS)
docker compose -f docker/docker-compose.yml down -v
```

## Customizing Ports

All ports are configurable via `.env`:

```bash
WEB_PORT=8080        # Web UI (default: 3000)
API_PORT=8081        # API (default: 4000)
POSTGRES_PORT=5433   # Postgres (default: 5432)
REDIS_PORT=6380      # Redis (default: 6379)
MINIO_API_PORT=9002  # MinIO API (default: 9000)
MINIO_CONSOLE_PORT=9003  # MinIO Console (default: 9001)
```

## Troubleshooting

### Services won't start

```bash
# Check container status
docker compose -f docker/docker-compose.yml ps -a

# Check specific service logs
docker compose -f docker/docker-compose.yml logs api --tail 50
```

### Database migration fails

```bash
# Check if Postgres is healthy
docker compose -f docker/docker-compose.yml exec postgres pg_isready

# View migration status
docker compose -f docker/docker-compose.yml exec api \
  npx prisma migrate status --schema=/app/apps/api/prisma/schema.prisma
```

### Port conflicts

If ports 3000, 4000, 5432, 6379, 9000, or 9001 are already in use, change them in `.env`.

### Out of disk space

```bash
# Clean unused Docker resources
docker system prune -a --volumes
```
