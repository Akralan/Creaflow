#!/usr/bin/env bash
# Met à jour l'app en production : récupère main, reconstruit l'image, applique les migrations,
# relance. À lancer depuis le VPS, dans le dossier du dépôt (docs/DEPLOIEMENT_VPS.md §6).
#
# L'ordre compte : les migrations tournent AVANT que la nouvelle version ne reçoive du trafic,
# avec l'ancienne version toujours en ligne. Une migration qui échoue arrête tout (set -e) et
# l'ancienne version continue de servir.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.prod.yml"
# Le service migrate est derrière le profil "tools" pour que `up -d` ne le relance pas à chaque
# fois ; build et run doivent donc activer ce profil explicitement.
TOOLS="$COMPOSE --profile tools"

echo "==> git pull"
git pull --ff-only

echo "==> build"
$TOOLS build app migrate

echo "==> migrations"
$TOOLS run --rm migrate

echo "==> redémarrage"
$COMPOSE up -d --remove-orphans

echo "==> nettoyage des anciennes images"
docker image prune -f >/dev/null

echo "OK — $($COMPOSE ps --format '{{.Name}} {{.Status}}' | tr '\n' ';')"
