# Architecture

Dernière mise à jour : octobre 2026

## Vue d'ensemble

```
┌──────────────────┐   angles + compteurs (JSON)   ┌──────────────────┐
│  App patient     │ ────────────────────────────▶ │  API FastAPI     │
│  Expo / TFLite   │ ◀──────────────────────────── │  PostgreSQL 16   │
│  (pose on-device)│   programme du jour            └────────┬─────────┘
└──────────────────┘                                         │
                                                             │ REST + JWT
                                                    ┌────────▼─────────┐
                                                    │ Dashboard kiné   │
                                                    │ Next.js 15       │
                                                    └──────────────────┘
```

Trois composants, un seul service avec état (l'API et sa base). L'app patient et le dashboard sont des clients sans persistance propre, hors cache local.

## App patient (`apps/patient`)

- Expo SDK 52, dev client (les modules natifs TFLite ne tournent pas dans Expo Go).
- Capture caméra : `react-native-vision-camera`, 640×480, orientation portrait.
- Inférence : `react-native-fast-tflite`, modèle `pose_landmark_full.tflite` (BlazePose, 33 points). Le modèle `lite` reste embarqué pour les appareils sous le seuil de performance (voir `pose-estimation.md`).
- Traitement par image, en pur TypeScript, dans `src/pose/` :
  1. `landmarks.ts` — normalisation des 33 points, filtrage de confiance (`visibility >= 0.6`)
  2. `angles.ts` — angles articulaires (`jointAngle(a, b, c)`)
  3. `repCounter.ts` — machine à états (voir `rep-counter.md`)
  4. `feedback.ts` — couleur du membre concerné (vert / orange / rouge)
- Contrôle de cadrage avant séance : `src/pose/framing.ts` vérifie que le patient est entier dans l'image et que l'angle de prise de vue est de trois quarts (`MIN_CAMERA_ANGLE_DEG = 45`), estimé par le ratio entre la largeur des épaules et celle des hanches projetées.
- Envoi en fin de séance : un seul `POST /api/v1/s/{code}/sessions` avec les séries d'angles échantillonnées à 10 Hz et les compteurs par exercice. Mise en file locale (`expo-sqlite`) si hors ligne, renvoi à la prochaine ouverture.

Aucune image, aucune vidéo, aucun point brut n'est envoyé. Le serveur ne reçoit que des angles en degrés et des compteurs.

## API (`services/api`)

- FastAPI, Pydantic v2, SQLAlchemy 2 (async), Alembic.
- Deux espaces d'authentification :
  - kiné : email + mot de passe, JWT (24 h) dans le header `Authorization`
  - patient : aucun compte, le code du lien d'invitation (`invite_links.code`, 6 lettres) fait office d'identifiant
- Modules : `mykine/auth`, `mykine/patients`, `mykine/programs`, `mykine/exercises`, `mykine/sessions`, `mykine/adherence`, `mykine/sms`.
- Le catalogue d'exercices est en base (`exercises`), alimenté par `mykine/seed.py` depuis `exercises.yaml`. L'app patient le télécharge avec le programme.
- Les séries d'angles sont stockées en JSONB (`sessions.angle_series`), pas dénormalisées : lecture par patient et par séance uniquement.

## Dashboard kiné (`apps/dashboard`)

- Next.js 15, App Router, rendu côté serveur pour les listes, client pour l'éditeur de programme.
- Appels à l'API via `src/lib/api.ts`, JWT en cookie `httpOnly` posé par `/api/session`.
- Écrans : voir `dashboard-kine.md`.

## Flux d'une séance

1. Le kiné crée un patient et un programme (`POST /api/v1/patients`, `POST /api/v1/programs`).
2. L'API génère un lien d'invitation et l'envoie par SMS (`POST /api/v1/patients/{id}/invite`).
3. Le patient ouvre `mykine.app/s/<code>`. L'app (ou la page web de repli) appelle `GET /api/v1/s/{code}` et reçoit le programme du jour.
4. Contrôle de cadrage, puis exercices l'un après l'autre. Compteur et feedback tournent sur l'appareil.
5. `POST /api/v1/s/{code}/sessions` envoie le compte-rendu.
6. Le dashboard affiche la séance et met à jour le taux d'adhésion (`GET /api/v1/patients/{id}/adherence`).

## Ce qui n'existe pas

- Pas de traitement vidéo côté serveur, par conception.
- Pas de temps réel entre patient et kiné : le kiné lit les séances a posteriori.
- Pas de notification push : rappels par SMS uniquement (`sms.reminders`, désactivé par défaut).
