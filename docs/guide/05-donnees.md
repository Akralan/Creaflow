# 05 — Données

Source unique : `src/db/schema.ts` (40 tables, Drizzle, PostgreSQL). Ce document donne la **carte** et les **règles** ; le détail colonne par colonne est dans le schéma (très commenté) et dans `docs/TECH.md` §3 (long, partiellement périmé).

## La carte en quatre blocs

```
COMPTE ─────────────  users · creator_profiles · oauth_accounts · social_connections
                      subscriptions · consumed_weeks · login_tokens · password_reset_tokens
                      start_jobs · rate_limit_buckets · posting_goals

MATIÈRE ────────────  products (= « sujets ») · material_sources · source_materials
                      material_events (ligne de temps) · source_material_citations
                      inspirations · brand_assets · google_drive_connections
                      assistant_attachments · subject_interview_sessions

ÉDITORIAL ──────────  content_series · content_categories (= « rôles ») · content_angles
                      content_series_categories · content_categories_platforms
                      content_series_platforms · calendar_entries
                      scripts · visual_designs · post_animations
                      script_generation_events · script_micro_edit_events

MESURE & ASSISTANT ─  post_metrics · post_metrics_snapshots · post_match_candidates
                      assistant_sessions · assistant_proposals
```

## Les objets qu'il faut comprendre

| Objet (table) | Ce que c'est | Pièges |
| :--- | :--- | :--- |
| **users** | Un compte. `passwordHash` **nullable** (comptes OAuth et comptes nés de `/start`). Quotas perso : `scriptLimit`, `microEditLimit`, `weekLimit`. | `vertical` est posé à la création et **n'aiguille plus rien**. Le login refuse proprement un compte sans mot de passe. |
| **creator_profiles** | Profil (1:1) : activité, audience, jours de publication, langue, pseudo X, `style_profile` appris. | Plus de ton, valeurs, matériel, temps disponible. |
| **products** | Un **sujet** (l'UI dit « sujet », le code dit « product » : renommage purement visuel). Porte `description`, `targetAudience`, `problem`, `readerPortrait` (1-3 publics). | `valueProposition` dit ce qu'on offre, `problem` le mal qu'on soigne : ne pas mélanger. |
| **material_sources** | Une source connectée (dépôt GitHub, page Notion, projet Linear) rattachée à un sujet. Unique sur `(userId, type, externalId)`. | Pas de colonnes GitHub sur `products` — voulu. |
| **source_materials** | Un **document** de matière (un `.md`, le journal de commits, un texte collé, un fichier). | `sourceId` en **CASCADE**, volontairement : supprimer une source supprime son miroir. Les citations passent en `SET NULL`. Sinon des `.md` orphelins deviendraient de la matière « de marque » injectée dans **toutes** les générations. |
| **material_events** | Un **pointeur** : `sourceMaterialId` + `line` + `date`, plus son **`genre`** (13 valeurs, `docs/FORMES_ET_GENRES.md`) avec `disponible` et `tient` (l'événement antérieur qu'il réalise ou sur lequel il revient). Rien d'autre depuis le 2026-10-24 — ni titre, ni faits, ni public, ni extrait. | Pour savoir ce que contient un événement, on ouvre le document à cette ligne. Le genre décide de la **forme** du post (`scripts.form`). `scripts.event_ids` dit où il a été raconté. |
| **content_series** | La **série** = seul objet éditorial manipulé. `rhythm` (jsonb), `skippedSlots`, `readerLabel`, `form` (jsonb), `productId`. | `weight` n'est plus lu (reste comme ordre d'affichage). `mode`, `framing` : jamais lus. |
| **content_categories** | Un **rôle** éditorial (pourquoi le post existe : expertise, coulisses, preuve sociale…). Unique par série, ou porté par un post libre. | Le code dit « category », l'UI « role ». |
| **scripts** | Un **post** pour **un seul réseau** (`platform`). Blocs : `title`, `hookText`, `hookVisual`, `storyboard`, `caption`, `hashtags`. Porte `concept` (gelé), `firstDraftSnapshot`, `generationTrace`, `eventId`, `seriesId`, `visualFormat`, et pour le fil narratif `narrativeKind`, `promisesMade`, `promiseHonored`, `promiseMatch`, `promiseSourceScriptId`. | `status` : `draft` = Draft, `planned` = Ready, `published` = Posted ; `shot` (hérité de la vidéo) se lit comme Ready. `beatId` : jamais écrit. |
| **calendar_entries** | Un **créneau** : une ligne **par réseau**, donc un jour de série = deux créneaux (LinkedIn, X). `kind` + `narrative_kind` disent ce que le post s'est avéré être. | `status` inclut `generating`. `generatingSince` permet la reprise. Les deux créneaux d'un jour se groupent par `(série, date)`. `kind` est écrit **à l'écriture**, pas à la pose du créneau. |
| **visual_designs** | La maquette HTML d'un script visuel, **une version courante** par script (`script_id` unique). | Commune aux deux réseaux : accrochée au script LinkedIn, lue par la version X. |
| **post_metrics / _snapshots / post_match_candidates** | Chiffres d'un post, historique daté, et candidats au rattachement d'un vrai post à un script. | Le rattachement non ambigu pose Posted tout seul ; sinon confirmation demandée. |
| **consumed_weeks** | Une semaine « brûlée » par le quota d'essai. | Gravée **avant** l'appel au modèle : un échec du modèle ne la rend pas. |
| **start_jobs** | Une ligne par compte né de `/start` : `stage` (`queued → profile → series → post → mailed` ou `failed`). | Rend la génération reprenable et sans doublon. |

## Règles de données

1. **Aucune table ni colonne par verticale.** Test : `src/db/schemaInvariants.test.ts`.
2. **`provider` est du texte, pas un enum** (`oauth_accounts.provider`) : un fournisseur de plus ne doit pas coûter une migration.
3. **On ne supprime pas ce que l'app a cessé de lire.** Les colonnes et tables de l'ancien rédacteur en chef restent sans migration destructive ; les données des réseaux retirés restent en base, plus affichées. Une table supprimée ne se récupère pas, une colonne dormante ne coûte presque rien.
4. **Les clés étrangères choisissent leur sort à la suppression** : `CASCADE` pour ce qui appartient à l'utilisateur, `SET NULL` pour ce qui doit survivre (un script survit à la suppression de son événement, sa série ou son sujet).
5. **Pas de trigger `updatedAt`** : mis à jour explicitement à chaque écriture de contenu.
6. **Les jetons** (réinitialisation, connexion par lien) sont stockés **hachés** (SHA-256), jamais en clair.
7. **Les tokens OAuth des fournisseurs** se lisent uniquement par `getValidProviderAccessToken` (rafraîchissement paresseux) — jamais en direct.

## Migrations

54 fichiers SQL dans `drizzle/` (`0000` → `0053`). État : appliquées en base de dev. Le VPS a été déployé le 2026-10-16 et les fiches de chantier notent « en dev seulement » pour les migrations `0036` et suivantes : **vérifier l'état réel du VPS avant tout déploiement** (`10-exploitation.md`).

Particularités : `0027` (renommage `onboarding_track` → `vertical`) et `0028` (`github_accounts` → `oauth_accounts`) écrites à la main ; `0035` renumérotée après le merge de la composition visuelle (qui occupe `0033-0034`) ; la base exige l'extension **pgvector** (migration `0007`).
