#!/usr/bin/env bash
# Nightly Postgres backup. Dumps the compose `db` service to ./backups, keeps
# the last 14 days, and (if R2_* env vars + the `aws` CLI exist) also copies the
# dump to Cloudflare R2.
#
# Host crontab (as the deploy user), e.g. 02:30 every night:
#   30 2 * * * cd ~/theadventuremafia && ./scripts/backup-db.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; [ -f .env.prod ] && . ./.env.prod || { [ -f .env ] && . ./.env; }; set +a

mkdir -p backups
FILE="backups/adventuremafia_$(date +%F_%H%M).sql.gz"

docker compose exec -T db pg_dump -U "${POSTGRES_USER:-adventure}" "${POSTGRES_DB:-adventuremafia}" | gzip > "$FILE"
echo "$(date -Is) wrote $FILE ($(du -h "$FILE" | cut -f1))"

find backups -name 'adventuremafia_*.sql.gz' -mtime +14 -delete

if [ -n "${R2_BUCKET:-}" ] && [ -n "${R2_ACCOUNT_ID:-}" ] && command -v aws >/dev/null 2>&1; then
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    aws s3 cp "$FILE" "s3://$R2_BUCKET/backups/$(basename "$FILE")" \
    --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" --region auto
  echo "$(date -Is) uploaded to R2"
fi
