#!/usr/bin/env bash
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { printf "${BLUE}[info]${NC}  %s\n" "$1"; }
ok()    { printf "${GREEN}[ok]${NC}    %s\n" "$1"; }
warn()  { printf "${YELLOW}[warn]${NC}  %s\n" "$1"; }
error() { printf "${RED}[error]${NC} %s\n" "$1"; }

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ─── Banner ──────────────────────────────────────────────────
printf "\n${CYAN}"
cat << 'EOF'
   ____            _            _    ___       ____ _           _
  / ___|___  _ __ | |_ _ __ ___(_)  / _ \__  / ___| |__   __ _| |_
 | |   / _ \| '_ \| __| '__/ _ \ | | | | \ \| |   | '_ \ / _` | __|
 | |__| (_) | | | | |_| | |  __/ | | |_| |\ \ |___| | | | (_| | |_
  \____\___/|_| |_|\__|_|  \___|_|  \___/  \_\____|_| |_|\__,_|\__|

EOF
printf "${NC}"
echo "  Self-Host Setup Script"
echo "  ────────────────────────────────────────────"
echo ""

# ─── Pre-flight checks ──────────────────────────────────────
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || { error "Docker is not installed. Install from https://docs.docker.com/get-docker/"; exit 1; }
ok "Docker found: $(docker --version | head -1)"

docker compose version >/dev/null 2>&1 || { error "Docker Compose V2 is required. Update Docker Desktop or install the compose plugin."; exit 1; }
ok "Docker Compose found: $(docker compose version | head -1)"

# ─── Environment file ───────────────────────────────────────
ENV_FILE="$REPO_ROOT/.env"

if [ -f "$ENV_FILE" ]; then
  warn ".env file already exists"
  printf "  Overwrite with fresh config? [y/N] "
  read -r OVERWRITE
  if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
    info "Keeping existing .env file"
  else
    cp "$REPO_ROOT/.env.example" "$ENV_FILE"
    ok "Copied .env.example → .env"
  fi
else
  cp "$REPO_ROOT/.env.example" "$ENV_FILE"
  ok "Created .env from .env.example"
fi

# ─── Generate secrets ───────────────────────────────────────
info "Generating secure secrets..."

generate_secret() {
  openssl rand -base64 "$1" 2>/dev/null || head -c "$1" /dev/urandom | base64 | tr -d '\n'
}

generate_hex() {
  openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | xxd -p | tr -d '\n'
}

JWT_SECRET_VAL=$(generate_secret 48)
JWT_REFRESH_VAL=$(generate_secret 48)
ENCRYPTION_KEY_VAL=$(generate_hex 32)
PG_PASSWORD_VAL=$(generate_secret 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
MINIO_PASSWORD_VAL=$(generate_secret 16 | tr -dc 'a-zA-Z0-9' | head -c 16)

replace_env() {
  local key="$1" value="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # Use | as delimiter to avoid issues with / in base64
    sed -i.bak "s|^${key}=.*|${key}=\"${value}\"|" "$file"
    rm -f "${file}.bak"
  fi
}

# Only replace placeholder values, not user-configured ones
if grep -q 'change-me-to-a-random-64-char-string' "$ENV_FILE" 2>/dev/null; then
  replace_env "JWT_SECRET" "$JWT_SECRET_VAL" "$ENV_FILE"
  replace_env "JWT_REFRESH_SECRET" "$JWT_REFRESH_VAL" "$ENV_FILE"
  ok "Generated JWT secrets"
fi

if grep -q 'change-me-32-byte-hex-key-here' "$ENV_FILE" 2>/dev/null; then
  replace_env "ENCRYPTION_KEY" "$ENCRYPTION_KEY_VAL" "$ENV_FILE"
  ok "Generated encryption key"
fi

# Always set strong DB and MinIO passwords on fresh setup
if grep -q 'POSTGRES_PASSWORD=centrai$' "$ENV_FILE" 2>/dev/null; then
  replace_env "POSTGRES_PASSWORD" "$PG_PASSWORD_VAL" "$ENV_FILE"
  # Also update DATABASE_URL with the new password
  sed -i.bak "s|centrai:centrai@|centrai:${PG_PASSWORD_VAL}@|g" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
  ok "Generated Postgres password"
fi

if grep -q 'MINIO_ROOT_PASSWORD=centrai123$' "$ENV_FILE" 2>/dev/null; then
  replace_env "MINIO_ROOT_PASSWORD" "$MINIO_PASSWORD_VAL" "$ENV_FILE"
  ok "Generated MinIO password"
fi

# ─── Optional: LLM provider API key ─────────────────────────
echo ""
info "Configure an LLM provider (optional — can also be done via admin UI later)"
printf "  Enter your OpenAI API key (or press Enter to skip): "
read -r OPENAI_KEY

if [ -n "$OPENAI_KEY" ]; then
  replace_env "OPENAI_API_KEY" "$OPENAI_KEY" "$ENV_FILE"
  ok "OpenAI API key configured"
else
  info "Skipped — configure providers later via the admin UI at /admin/providers"
fi

# ─── Build & start ───────────────────────────────────────────
echo ""
info "Building and starting all services..."
info "This may take several minutes on first run (downloading images + building)"
echo ""

docker compose -f "$REPO_ROOT/docker/docker-compose.yml" --env-file "$ENV_FILE" up -d --build 2>&1

echo ""

# ─── Wait for health ────────────────────────────────────────
info "Waiting for services to become healthy..."

MAX_WAIT=120
ELAPSED=0
API_READY=false

while [ $ELAPSED -lt $MAX_WAIT ]; do
  if curl -sf http://localhost:4000/api/v1/health >/dev/null 2>&1; then
    API_READY=true
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  printf "."
done
echo ""

if [ "$API_READY" = true ]; then
  ok "API is healthy"
else
  warn "API did not become healthy within ${MAX_WAIT}s — check logs with: docker compose -f docker/docker-compose.yml logs api"
fi

# ─── Summary ─────────────────────────────────────────────────
echo ""
printf "${GREEN}"
echo "  ════════════════════════════════════════════════════"
echo "  ✓  CentrAI-Chat is running!"
echo "  ════════════════════════════════════════════════════"
printf "${NC}"
echo ""
echo "  Web UI:        http://localhost:3000"
echo "  API:           http://localhost:4000"
echo "  API Docs:      http://localhost:4000/api/docs"
echo "  MinIO Console: http://localhost:9001"
echo ""
echo "  Default admin credentials:"
echo "    Email:    admin@centrai.local"
echo "    Password: Admin123!"
echo ""
echo "  Useful commands:"
echo "    View logs:    docker compose -f docker/docker-compose.yml logs -f"
echo "    Stop:         docker compose -f docker/docker-compose.yml down"
echo "    Full reset:   docker compose -f docker/docker-compose.yml down -v"
echo ""
warn "Change the default admin password after first login!"
echo ""
