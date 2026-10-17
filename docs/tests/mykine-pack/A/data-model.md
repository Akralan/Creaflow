# Modèle de données

Dernière mise à jour : octobre 2026 — migration Alembic `0014_session_device`

PostgreSQL 16. Identifiants UUID v4. Horodatages `timestamptz`, en UTC. Schéma déclaré dans `services/api/mykine/models/`.

## Tables

### `kines`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `email` | text | unique, minuscules |
| `password_hash` | text | argon2id |
| `name` | text | affiché au patient dans le SMS |
| `created_at` | timestamptz | |

### `patients`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `kine_id` | uuid | FK `kines`, `ON DELETE CASCADE` |
| `alias` | text | pseudonyme choisi par le kiné (« Genou 3 », « M. R. »). Aucun nom réel |
| `phone_enc` | bytea | `pgp_sym_encrypt`, clé `PHONE_KEY` |
| `phone_last2` | text | deux derniers chiffres, pour l'affichage masqué |
| `archived` | boolean | défaut `false` |
| `created_at` | timestamptz | |

Index : `(kine_id, archived)`.

### `invite_links`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `code` | text | PK, 6 lettres majuscules sans I, O, L (alphabet de 23) |
| `patient_id` | uuid | FK `patients`, cascade |
| `created_at` | timestamptz | |
| `expires_at` | timestamptz | défaut +90 jours |
| `revoked_at` | timestamptz | nullable |

Un patient peut avoir plusieurs liens (renvoi) ; le plus récent non révoqué est actif.

### `exercises`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | text | PK, slug (`squat`, `lunge_front`…) |
| `name` | text | |
| `position` | text | `standing`, `seated`, `wall` |
| `side` | text | `left`, `right`, `both` |
| `angle` | text | nom de l'angle (`kneeFlexion`…) |
| `inverted` | boolean | |
| `top_threshold` | smallint | |
| `bottom_target` | smallint | |
| `hold_seconds_default` | smallint | nullable, isométriques |
| `feedback` | jsonb | bornes vert / orange / rouge |
| `alignment` | jsonb | nullable |
| `version` | smallint | incrémenté à chaque changement de seuil |

Rechargée par `seed.py` depuis `exercises.yaml` ; les lignes existantes sont mises à jour, jamais supprimées.

### `programs`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `patient_id` | uuid | FK |
| `name` | text | |
| `starts_on` | date | |
| `ends_on` | date | nullable |
| `archived_at` | timestamptz | nullable |
| `created_at` | timestamptz | |

Contrainte : un seul programme non archivé par patient (index unique partiel sur `patient_id WHERE archived_at IS NULL`).

### `program_exercises`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `program_id` | uuid | FK, cascade |
| `exercise_id` | text | FK `exercises` |
| `position` | smallint | ordre dans la séance |
| `sets` | smallint | 1–5 |
| `target_reps` | smallint | nullable |
| `hold_seconds` | smallint | nullable |
| `side` | text | nullable |
| `days` | smallint[] | 1–7 |
| `note` | text | 200 caractères |

### `sessions`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `patient_id` | uuid | FK |
| `program_id` | uuid | FK |
| `client_session_id` | uuid | unique avec `patient_id` (idempotence) |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | |
| `device` | jsonb | modèle, fps, variante, saut d'images |
| `received_at` | timestamptz | |

### `session_exercises`

| Colonne | Type | Note |
| :--- | :--- | :--- |
| `id` | uuid | PK |
| `session_id` | uuid | FK, cascade |
| `exercise_id` | text | FK |
| `exercise_version` | smallint | version du catalogue au moment de la séance |
| `set_number` | smallint | |
| `reps` | smallint | |
| `partials` | smallint | |
| `target_reps` | smallint | nullable |
| `hold_seconds_done` | real | nullable |
| `min_angle_mean` | real | |
| `angle_series` | jsonb | `[[t, angle], …]`, 10 Hz |

Taille moyenne observée d'une ligne : 6 Ko. Pas d'index sur `angle_series`.

### `revoked_tokens`

| Colonne | Type |
| :--- | :--- |
| `jti` | text PK |
| `expires_at` | timestamptz |

Purgée par un cron quotidien.

## Ce qui n'est pas stocké

- Aucune image, aucune vidéo, aucune coordonnée de point.
- Aucun nom, prénom ou date de naissance de patient. Le téléphone est chiffré et ne sert qu'à l'envoi du SMS.
- Aucune donnée de diagnostic : le nom du programme est libre, mais le dashboard conseille de ne pas y mettre de pathologie.

## Rétention

`sessions` et `session_exercises` : conservées 24 mois après `ended_at`, puis supprimées par `mykine.jobs.purge`. Un patient archivé depuis 12 mois est supprimé avec ses séances.
