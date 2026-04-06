#!/bin/sh
set -e

echo "[api] Waiting for database to be ready..."

until node -e "
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  c.connect().then(() => { c.end(); process.exit(0); }).catch(() => process.exit(1));
" 2>/dev/null; do
  echo "[api] Database not ready, retrying in 2s..."
  sleep 2
done

echo "[api] Database is ready"

echo "[api] Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy 2>&1 || {
  echo "[api] Warning: Migration failed, attempting to continue..."
}

echo "[api] Seeding database (idempotent)..."
npx tsx prisma/seed.ts 2>&1 || {
  echo "[api] Warning: Seed failed (may already be seeded), continuing..."
}

cd /app

echo "[api] Starting API server..."
exec node apps/api/dist/main.js
