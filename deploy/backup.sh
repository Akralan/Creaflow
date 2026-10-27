#!/usr/bin/env bash
# Sauvegarde nocturne de la base vers un bucket R2 privé (docs/DEPLOIEMENT_VPS.md §7).
#
# pg_dump tourne dans le conteneur Postgres, l'envoi passe par l'image amazon/aws-cli (R2 parle
# S3) : rien à installer sur l'hôte à part Docker. Les identifiants viennent du .env de prod
# (R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, BACKUP_BUCKET). Le .env n'est pas
# `source`-é : EMAIL_FROM contient un `<` que le shell prendrait pour une redirection.
#
# Cron (tous les jours à 3h30, journal dans /var/log/creaflow-backup.log) :
#   30 3 * * * /opt/creaflow/deploy/backup.sh >> /var/log/creaflow-backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | head -n 1 | cut -d= -f2- | tr -d '\r'; }

R2_ENDPOINT="$(envval R2_ENDPOINT)"
R2_ACCESS_KEY_ID="$(envval R2_ACCESS_KEY_ID)"
R2_SECRET_ACCESS_KEY="$(envval R2_SECRET_ACCESS_KEY)"
BACKUP_BUCKET="$(envval BACKUP_BUCKET)"

for v in R2_ENDPOINT R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY BACKUP_BUCKET; do
  [ -n "${!v}" ] || { echo "$v manquant dans .env — sauvegarde impossible" >&2; exit 1; }
done

STAMP="$(date -u +%Y%m%d-%H%M%S)"
NAME="creaflow-${STAMP}.sql.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U creaflow --no-owner --no-privileges creaflow | gzip -9 > "$TMP/$NAME"

docker run --rm \
  -v "$TMP:/data:ro" \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  amazon/aws-cli s3 cp "/data/$NAME" "s3://$BACKUP_BUCKET/$NAME" --endpoint-url "$R2_ENDPOINT" --only-show-errors

echo "$(date -u +%FT%TZ) sauvegarde envoyée : s3://$BACKUP_BUCKET/$NAME ($(du -h "$TMP/$NAME" | cut -f1))"
