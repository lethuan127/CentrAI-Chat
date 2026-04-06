#!/bin/sh
set -e

echo "[api] Waiting for database to be ready..."

# Resolve pg from @centrai/api deps (pnpm layout: not hoisted to /app/node_modules)
until (cd /app/apps/api && node -e "
  const { Client } = require('pg');
  const u = process.env.DATABASE_URL;
  if (!u) { console.error('[api] DATABASE_URL is not set'); process.exit(1); }
  const c = new Client({ connectionString: u });
  c.connect()
    .then(() => { c.end(); process.exit(0); })
    .catch((e) => {
      console.error('[api] DB connection:', e.code || e.message);
      process.exit(1);
    });
"); do
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
tsx prisma/seed.ts 2>&1 || {
  echo "[api] Warning: Seed failed (may already be seeded), continuing..."
}

cd /app

echo "[api] Starting API server..."
exec node apps/api/dist/main.js
