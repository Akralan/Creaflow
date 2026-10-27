#!/usr/bin/env bash
# Synchronisation quotidienne des sources de matière (docs/SPEC_SYNCHRO_QUOTIDIENNE.md,
# docs/DEPLOIEMENT_VPS.md §8) : appelle POST /api/cron/sync avec le secret du .env de prod.
# L'app n'a pas de planificateur ; c'est ce cron qui donne le rythme. Le rapport JSON finit dans le
# journal. Le .env n'est pas `source`-é (voir backup.sh).
#
# Cron (tous les jours à 4h15, après la sauvegarde de 3h30) :
#   15 4 * * * /opt/creaflow/deploy/sync.sh >> /var/log/creaflow-sync.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

envval() { grep -E "^$1=" .env | head -n 1 | cut -d= -f2- | tr -d '\r'; }

APP_URL="$(envval APP_URL)"
CRON_SECRET="$(envval CRON_SECRET)"

for v in APP_URL CRON_SECRET; do
  [ -n "${!v}" ] || { echo "$v manquant dans .env — synchronisation impossible" >&2; exit 1; }
done

echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) sync start"
# 40 minutes au plus : la route s'arrête d'elle-même après 25 minutes et reprend la nuit suivante.
curl -fsS --max-time 2400 -X POST -H "Authorization: Bearer ${CRON_SECRET}" "${APP_URL%/}/api/cron/sync"
echo
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) sync done"
