# MyKiné

Dernière mise à jour : octobre 2026 — version 0.4

Suivi à distance des exercices de rééducation. Le kiné prescrit un programme depuis un dashboard web ; le patient réalise ses exercices chez lui devant la caméra de son téléphone ; l'application compte les répétitions, vérifie l'amplitude et l'alignement en direct, puis envoie un compte-rendu de séance au kiné.

Aucune vidéo ne quitte le téléphone. Seuls les angles articulaires et les compteurs sont transmis au serveur.

## Dépôt

Monorepo, trois applications :

| Dossier | Rôle | Stack |
| :--- | :--- | :--- |
| `apps/patient` | Application patient (Android, iOS, repli web) | Expo / React Native, TypeScript, MediaPipe Pose (TFLite) |
| `apps/dashboard` | Dashboard kiné | Next.js 15, TypeScript, Tailwind |
| `services/api` | API et persistance | Python 3.12, FastAPI, SQLAlchemy, PostgreSQL 16 |
| `hardware/boitier` | Spec du boîtier (statut : abandonné) | — |
| `docs/` | Documentation technique | — |

## Prérequis

- Node 22, pnpm 9
- Python 3.12, uv
- PostgreSQL 16 (ou Docker)
- Pour l'app patient : Android Studio ou Xcode, et un appareil physique (la pose estimation ne tourne pas dans les simulateurs)

## Démarrage

```bash
# base de données
docker compose up -d db

# API
cd services/api
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn mykine.main:app --reload --port 8000

# dashboard
cd apps/dashboard
pnpm install
pnpm dev            # http://localhost:3000

# app patient (dev client Expo, appareil physique)
cd apps/patient
pnpm install
pnpm expo run:android   # ou run:ios
```

Un kiné de démonstration est créé par `uv run python -m mykine.seed` : `demo@mykine.app` / `demo-demo`.

## Variables d'environnement

| Variable | Service | Rôle |
| :--- | :--- | :--- |
| `DATABASE_URL` | api | `postgresql+psycopg://mykine:mykine@localhost:5432/mykine` |
| `JWT_SECRET` | api | signature des sessions kiné |
| `SMS_PROVIDER` | api | `console` (dev) ou `brevo` |
| `BREVO_API_KEY` | api | envoi des liens patient |
| `APP_BASE_URL` | api | base des liens courts, `https://mykine.app` en prod |
| `EXPO_PUBLIC_API_URL` | patient | URL de l'API |
| `NEXT_PUBLIC_API_URL` | dashboard | URL de l'API |

## Tests

```bash
cd services/api && uv run pytest
cd apps/patient && pnpm test        # compteur de répétitions et calcul d'angles, en pur
cd apps/dashboard && pnpm test
```

Les tests du compteur rejouent des séries d'angles enregistrées dans `apps/patient/fixtures/reps/` (120 répétitions de squat annotées à la main).

## Documentation

- `docs/architecture.md` — composants et flux de données
- `docs/pose-estimation.md` — modèle, points, angles, performances
- `docs/rep-counter.md` — machine à états du compteur
- `docs/exercises.md` — catalogue des 14 exercices
- `docs/backend-api.md` — endpoints
- `docs/data-model.md` — tables
- `docs/dashboard-kine.md` — écrans kiné
- `docs/patient-flow.md` — parcours patient sans compte
- `docs/privacy.md` — données collectées, anonymisation
- `docs/deployment.md` — mise en production
- `docs/roadmap.md` — versions
- `docs/VISION.md` — produit, cible, prix

## Licence

Propriétaire. Code non publié.
