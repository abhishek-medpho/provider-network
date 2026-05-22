#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
node_modules/.bin/prisma migrate deploy

if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
  echo "[entrypoint] Running seed (idempotent upserts)..."
  node_modules/.bin/tsx prisma/seed.ts || {
    echo "[entrypoint] Seed failed — continuing boot."
  }
else
  echo "[entrypoint] SEED_ON_BOOT=false — skipping seed."
fi

echo "[entrypoint] Starting app: $@"
exec "$@"
