# API

Dernière mise à jour : octobre 2026

Base : `/api/v1`. JSON partout. Erreurs au format `{ "detail": "..." }` avec le code HTTP adapté.

Deux espaces :

- **Kiné** — `Authorization: Bearer <jwt>`. JWT HS256, `JWT_SECRET`, validité 24 h.
- **Patient** — pas d'authentification. Le code du lien (`/s/{code}`, 6 lettres majuscules) identifie le patient. Un code invalide ou expiré répond 404 sans distinction.

Documentation OpenAPI servie sur `/docs` en dev, désactivée en production.

## Authentification kiné

| Méthode | Route | Rôle |
| :--- | :--- | :--- |
| POST | `/auth/login` | `{ email, password }` → `{ token, kine: { id, name } }` |
| POST | `/auth/logout` | Révoque le token (liste noire en base, `revoked_tokens`) |
| GET | `/auth/me` | Kiné courant |

Pas d'inscription en libre-service : les comptes sont créés par `python -m mykine.create_kine`.

## Patients

| Méthode | Route | Rôle |
| :--- | :--- | :--- |
| GET | `/patients` | Liste des patients du kiné, avec `adherence_7d` |
| POST | `/patients` | `{ alias, phone }` → patient. `alias` est le pseudonyme choisi par le kiné |
| GET | `/patients/{id}` | Fiche |
| PATCH | `/patients/{id}` | `alias`, `phone`, `archived` |
| POST | `/patients/{id}/invite` | Génère un lien (`invite_links`), envoie le SMS, renvoie `{ code, url, expires_at }` |
| GET | `/patients/{id}/sessions` | Séances, de la plus récente à la plus ancienne, `?limit=` (défaut 30) |
| GET | `/patients/{id}/adherence` | `{ window_days, planned, done, rate }` ; `?window=7|30` |

Le téléphone est stocké chiffré (`pgcrypto`, clé `PHONE_KEY`) et n'est jamais renvoyé en clair après création ; `GET /patients/{id}` renvoie `phone_masked` (`+33 6 ** ** ** 42`).

## Programmes

| Méthode | Route | Rôle |
| :--- | :--- | :--- |
| GET | `/programs?patient_id=` | Programmes d'un patient |
| POST | `/programs` | Crée un programme (voir corps ci-dessous) |
| PUT | `/programs/{id}` | Remplace les exercices et les jours |
| POST | `/programs/{id}/archive` | Archive ; le patient ne le voit plus |

Corps de création :

```json
{
  "patient_id": "9c1e…",
  "name": "Genou post-op semaine 3",
  "starts_on": "2026-10-13",
  "ends_on": "2026-11-10",
  "exercises": [
    { "exercise_id": "squat", "sets": 3, "target_reps": 12, "days": [1, 3, 5], "note": "Descends lentement" },
    { "exercise_id": "wall_sit", "sets": 2, "hold_seconds": 30, "days": [1, 3, 5] },
    { "exercise_id": "step_up", "sets": 3, "target_reps": 10, "side": "left", "days": [2, 4] }
  ]
}
```

`days` : 1 = lundi … 7 = dimanche. Un programme actif par patient à la fois (409 sinon).

## Exercices

| Méthode | Route | Rôle |
| :--- | :--- | :--- |
| GET | `/exercises` | Catalogue complet (14 entrées), avec seuils et feedback |

## Espace patient

| Méthode | Route | Rôle |
| :--- | :--- | :--- |
| GET | `/s/{code}` | Programme du jour : `{ patient_alias, program, today_exercises, catalog }` |
| POST | `/s/{code}/sessions` | Dépose une séance |
| GET | `/s/{code}/history` | 30 dernières séances, résumé par séance (date, exercices faits, total reps) |

Corps d'une séance :

```json
{
  "client_session_id": "b7f4…",
  "started_at": "2026-10-14T18:02:11Z",
  "ended_at": "2026-10-14T18:14:40Z",
  "device": { "model": "Pixel 4a", "fps": 9, "model_variant": "full", "frame_skip": 2 },
  "exercises": [
    {
      "exercise_id": "squat",
      "set": 1,
      "reps": 12,
      "partials": 2,
      "target_reps": 12,
      "min_angle_mean": 96.4,
      "angle_series": [[0.0, 171.2], [0.1, 170.8]]
    }
  ]
}
```

`client_session_id` rend l'envoi idempotent : un renvoi après coupure réseau ne crée pas de doublon (200 au lieu de 201).

Limites : 50 exercices par séance, 6 000 points par `angle_series` (10 minutes à 10 Hz), corps total 2 Mo.

## SMS

Fournisseur derrière `mykine/sms/provider.py` : `ConsoleProvider` (dev, écrit dans les logs) ou `BrevoProvider`. Deux messages seulement :

- invitation : `MyKiné — {kine_name} t'a préparé tes exercices : {url}`
- rappel (optionnel, `sms.reminders`) : `MyKiné — c'est le jour de tes exercices : {url}`

## Codes de réponse

| Code | Cas |
| :--- | :--- |
| 400 | Corps invalide (détail Pydantic) |
| 401 | Token absent, expiré ou révoqué |
| 404 | Ressource inconnue, ou code patient invalide |
| 409 | Programme actif déjà existant |
| 413 | Séance trop volumineuse |
| 429 | Plus de 20 dépôts de séance par heure pour un même code |
