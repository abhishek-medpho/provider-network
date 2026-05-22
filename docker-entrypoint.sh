#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
node node_modules/prisma/build/index.js migrate deploy

if [ "${SEED_ON_BOOT:-true}" = "true" ]; then
  echo "[entrypoint] Running seed (idempotent upserts)..."
  node node_modules/tsx/dist/cli.mjs prisma/seed.ts || {
    echo "[entrypoint] Seed failed — continuing boot."
  }
else
  echo "[entrypoint] SEED_ON_BOOT=false — skipping seed."
fi

echo "[entrypoint] Starting app: $@"
exec "$@"
