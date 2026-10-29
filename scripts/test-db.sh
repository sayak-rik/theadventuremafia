#!/usr/bin/env bash
# Runs the full test suite (including real-Postgres suites) against a throwaway
# postgres:16-alpine container: loads db/init/*.sql like a fresh install, then
# runs the tracked migrations twice (idempotency), then vitest.
#
#   npm run test:db
set -euo pipefail

NAME="tam_test_db_$$"
PORT="${TEST_DB_PORT:-55432}"
cd "$(dirname "$0")/.."

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" \
  -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test \
  -p "$PORT:5432" \
  -v "$PWD/db/init:/docker-entrypoint-initdb.d:ro" \
  postgres:16-alpine >/dev/null

echo "Waiting for Postgres (init scripts run on first boot)..."
for _ in $(seq 1 60); do
  # The init phase restarts the server once; wait for the final instance.
  if docker logs "$NAME" 2>&1 | grep -q "PostgreSQL init process complete" \
     && docker exec "$NAME" pg_isready -U test -d test >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

export TEST_DATABASE_URL="postgres://test:test@localhost:$PORT/test"
echo "Applying migrations twice (idempotency check)..."
DATABASE_URL="$TEST_DATABASE_URL" node scripts/migrate.mjs
DATABASE_URL="$TEST_DATABASE_URL" node scripts/migrate.mjs

npx vitest run "$@"
