#!/usr/bin/env sh
set -eu

ENV_FILE="${1:-.env.production}"
test -f "$ENV_FILE"
set -a
. "$ENV_FILE"
set +a
: "${TEST_DATABASE_URL:?TEST_DATABASE_URL must point to a disposable test database}"
PRODUCTION_DATABASE_URL="$DATABASE_URL"
PRODUCTION_APP_ORIGIN="$APP_ORIGIN"

npm ci
npm run db:generate
NODE_ENV=test DATABASE_URL="$TEST_DATABASE_URL" APP_ORIGIN="${TEST_APP_ORIGIN:-http://127.0.0.1:5173}" npm run typecheck
NODE_ENV=test DATABASE_URL="$TEST_DATABASE_URL" APP_ORIGIN="${TEST_APP_ORIGIN:-http://127.0.0.1:5173}" npm run test:run
NODE_ENV=test DATABASE_URL="$TEST_DATABASE_URL" APP_ORIGIN="${TEST_APP_ORIGIN:-http://127.0.0.1:5173}" npm run build
export DATABASE_URL="$PRODUCTION_DATABASE_URL"
export APP_ORIGIN="$PRODUCTION_APP_ORIGIN"
docker compose --env-file "$ENV_FILE" config --quiet
docker compose --env-file "$ENV_FILE" build
docker compose --env-file "$ENV_FILE" up -d

HTTP_PORT="$(grep '^HTTP_PORT=' "$ENV_FILE" | tail -1 | cut -d= -f2-)"
HTTP_PORT="${HTTP_PORT:-8080}"
i=0
until wget -q -O /dev/null "http://127.0.0.1:${HTTP_PORT}/health/ready"; do
  i=$((i + 1))
  [ "$i" -lt 60 ] || exit 1
  sleep 3
done

docker compose --env-file "$ENV_FILE" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/release-check.dump'
docker compose --env-file "$ENV_FILE" exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" --if-exists studio_tasks_verify && createdb -U "$POSTGRES_USER" studio_tasks_verify'
docker compose --env-file "$ENV_FILE" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d studio_tasks_verify /tmp/release-check.dump'
docker compose --env-file "$ENV_FILE" exec -T postgres sh -c 'test "$(psql -U "$POSTGRES_USER" -d studio_tasks_verify -tAc "select count(*) from _prisma_migrations")" -ge 1'
docker compose --env-file "$ENV_FILE" exec -T postgres sh -c 'dropdb -U "$POSTGRES_USER" studio_tasks_verify && rm -f /tmp/release-check.dump'

if rg -n 'Demo123|Admin123|resetDemoState|PrototypeRepository|localStorage' . \
  --glob '!docs/**' --glob '!scripts/release-check.*' --glob '!node_modules/**' \
  --glob '!packages/contracts/dist/**' --glob '!apps/**/dist/**'; then
  exit 1
fi

echo "Release checks passed: http://127.0.0.1:${HTTP_PORT}/health/ready"
