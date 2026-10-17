# Déploiement

Dernière mise à jour : octobre 2026

## Production

Un VPS Scaleway DEV1-S (2 vCPU, 2 Go, Paris) porte l'API, la base et le dashboard. Docker Compose, Caddy en frontal.

```
mykine.app            → dashboard (Next.js, standalone)
api.mykine.app        → API FastAPI
mykine.app/s/{code}   → page de redirection vers l'app (servie par le dashboard)
```

### `docker-compose.prod.yml`

| Service | Image | Note |
| :--- | :--- | :--- |
| `db` | `postgres:16` | volume `pgdata`, `pgcrypto` activé par la migration `0003` |
| `api` | `ghcr.io/mykine/api:<sha>` | `uvicorn`, 2 workers |
| `migrate` | même image que `api` | `alembic upgrade head`, s'arrête ensuite |
| `dashboard` | `ghcr.io/mykine/dashboard:<sha>` | Next.js standalone |
| `caddy` | `caddy:2` | TLS automatique, `Caddyfile` dans `deploy/` |
| `jobs` | même image que `api` | cron : purge des tokens, rétention, rappels SMS |

### Mise à jour

```bash
ssh mykine
cd /srv/mykine
./deploy/update.sh <sha>     # pull, migrate, up -d, healthcheck
```

`update.sh` refuse de continuer si `migrate` sort en erreur ; les conteneurs précédents restent en place.

### Sauvegardes

`deploy/backup.sh`, cron quotidien à 03:00 : `pg_dump` compressé, chiffré avec `age` (clé publique dans `deploy/backup.pub`), envoyé vers un bucket Scaleway Object Storage (Paris), rétention 30 jours. Restauration testée par `deploy/restore.sh <date>` sur une base vide.

### Secrets

Fichier `/srv/mykine/.env`, droits `600`, jamais dans le dépôt :

```
DATABASE_URL=
JWT_SECRET=
PHONE_KEY=
BREVO_API_KEY=
APP_BASE_URL=https://mykine.app
SMS_PROVIDER=brevo
```

`PHONE_KEY` n'existe qu'à cet endroit et dans le gestionnaire de mots de passe de l'auteur.

### Supervision

- `GET /api/v1/health` : vérifie la connexion base, renvoie la version déployée.
- Uptime : sonde externe toutes les 5 minutes sur `/health` et sur `mykine.app`.
- Logs : `docker compose logs`, rotation 50 Mo × 5. Pas de collecteur externe.
- Erreurs API : Sentry, DSN en variable d'environnement, sans envoi du corps des requêtes (`send_default_pii = False`, `max_request_body_size = "never"`).

## App patient

### Android

- Build EAS, profil `production`, AAB signé, Play Console, suivi interne puis production.
- `assetlinks.json` servi sur `mykine.app/.well-known/` pour les liens universels.
- Permission `CAMERA` seulement. Pas de permission stockage ni réseau en arrière-plan.

### iOS

- Build EAS, profil `production`, TestFlight puis App Store.
- `apple-app-site-association` sur `mykine.app/.well-known/`.
- `react-native-fast-tflite` avec délégué Core ML activé (`coreMLDelegate: true`), sans quoi le modèle `full` tourne sous 8 fps sur iPhone 11.
- Expo SDK épinglé à `52.0.x` ; montée de version uniquement après vérification manuelle de la caméra sur un appareil physique.

### Web de repli

`pnpm expo export --platform web`, servi par le dashboard sous `/web/`. MediaPipe en WebAssembly (`@mediapipe/tasks-vision`), modèle `lite` uniquement.

## Environnements

| Env | API | Base | SMS |
| :--- | :--- | :--- | :--- |
| dev | `localhost:8000` | Docker local | `console` |
| staging | `api.staging.mykine.app` | même VPS, base séparée | `console` |
| prod | `api.mykine.app` | VPS | `brevo` |

L'app patient pointe vers l'API par `EXPO_PUBLIC_API_URL`, fixée au build (un build par environnement).

## Dimensionnement

Charge observée en v0.4 : 412 séances en 5 mois, pointe à 14 séances par jour, taille de la base 61 Mo. Le DEV1-S est très au-dessus du besoin. Seuil de changement prévu : 200 séances par jour ou 5 Go de base.
