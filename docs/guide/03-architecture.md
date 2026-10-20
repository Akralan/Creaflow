# 03 — Architecture

## Vue d'ensemble

Une **seule application Next.js** (App Router, Next 16 — attention : `AGENTS.md` prévient que cette version a des changements cassants ; lire `node_modules/next/dist/docs/` avant de coder) avec ses routes API co-localisées. Une base **PostgreSQL** (image `pgvector`). Pas de backend séparé, pas de Redis, pas de cron, pas de file de tâches.

```
 Navigateur ─────────────────────────────────────────────────────────┐
   React 19 (src/app, src/components)                                │
        │ fetch /api/...                                              │ export PNG / MP4
        ▼                                                            │ (dans le navigateur)
 Routes API Next (src/app/api/**/route.ts)  ── mince : validation Zod ┘
        │
        ▼
 Services (src/lib/services/*)  ── la logique métier, une fonction = un geste
        │                │
        ▼                ▼
 Drizzle ORM         Couche LLM (src/lib/llm/*)  ──► OpenAI (seul provider opérationnel)
 (src/db/schema.ts)       │                          Gemini (vision des photos, seulement)
        │                 └─ outils, prompts, contrôles du code
        ▼
 PostgreSQL (pgvector)        Connecteurs (GitHub, Notion, Linear) · Social (LinkedIn, X/Apify)
                              Stripe · Brevo · R2 (photos) · Photoroom · Sentry
```

## Choix d'architecture à connaître

- **Pas de tâches planifiées.** Tout ce qui est « de fond » passe par `after()` de Next (le serveur du VPS est un processus durable) ou se déclenche à l'usage : le rafraîchissement des tokens OAuth est **paresseux**, la purge du rate-limit est **probabiliste**, la synchronisation d'une source est un **bouton**. Une reprise après redémarrage existe pour les créneaux « en chargement » (`startRecovery.ts`).
- **Routes pensées par écran**, pas par entité : chaque écran se charge avec le minimum d'appels (jointures Drizzle).
- **Rate limiting dans Postgres** (`rate_limit_buckets`, fenêtre fixe) — pas de Redis. L'IP vient de `X-Forwarded-For` ; absente, le contrôle par IP est sauté (jamais de bucket « unknown » partagé).
- **CSP sans nonce**, `style-src 'unsafe-inline'` (l'app utilise des `style={{}}` partout). Pas de CORS ouvert, volontairement ; cookie de session `sameSite: lax`.
- **Sessions** : cookie JWT. `getCurrentUserId` relit l'utilisateur à chaque requête ; un jeton émis avant `users.sessionsInvalidatedBefore` est refusé.
- **Aucun appel LLM pendant l'ingestion** d'une source : fetch + écriture seulement. La lecture des événements (qui coûte) est une étape distincte.

## Arborescence utile

```
src/
  app/                 Pages et routes API (Next App Router)
    (app)/             Coque connectée : calendar, plan, context, performance,
                       direction, settings, assistant, scripts/[id]
    start/  onboarding/  login/  connexion/lien/   Entrées publiques
    admin/quotas/      Réservé aux ADMIN_EMAILS
    api/               98 routes (auth, scripts, series, events, materials,
                       material-sources, connectors, performance, billing…)
    legal/  stories/   Pages publiques
  components/          Composants (AppShell, ScriptEditor, DesignEditor, landing/, start/, app/…)
  db/schema.ts         UNIQUE source du modèle de données (40 tables)
  lib/
    llm/               Tout ce qui parle à un modèle : prompts, outils, contrôles (voir 04)
    services/          La logique métier (51 fichiers)
    connectors/        GitHub, Notion, Linear (registre + mapping de ce qu'est un « sujet »)
    github/ notion/ linear/ oauth/   Clients et OAuth des fournisseurs
    social/            LinkedIn, X (+ Apify), Instagram (code mort côté UI)
    performance/       Dérivation de l'écran Performance
    visualDesign/      Maquette HTML du post visuel (formats, kit de marque, sanitizer)
    animationHtml/     Animation en HTML libre (contrôle, lecteur, polices)
    billing/ email/ legal/ storage/ auth/ api/ imaging/ design/
    seriesRhythm.ts    Rythme des séries
    weekPosts.ts       Groupement d'une semaine de posts
drizzle/               Migrations SQL (0000 → 0053), écrites par drizzle-kit
scripts/               setup.mjs, bancs d'essai, seed de démo (hors app)
deploy/                Caddyfile, update.sh, backup.sh, modèle de .env de prod
docs/                  Documentation (voir 09-carte-des-docs.md)
```

## Comment une requête circule — exemple : « Prepare next week »

1. Le bouton appelle `POST /api/weeks/prepare`.
2. La route valide (Zod), identifie l'utilisateur, applique le rate-limit.
3. Elle appelle un service (`calendarWeekService`, `postWriteService`, `postPairService`) :
   quota en semaines vérifié **avant** ; si atteint → réponse qui ouvre la modale de paiement.
4. Les créneaux de la semaine passent en `generating` ; l'écriture continue en fond (`after()`).
5. Pour chaque créneau : événement choisi → rédacteur agentique → LinkedIn **puis** X (deux scripts, même événement, même créneau) → contrôles du code → écriture.
6. L'écran se rafraîchit seul jusqu'à l'arrivée des posts. Un créneau resté « en chargement » plus de 10 minutes revient à `planned`.

## Conventions de code

- **Code et commentaires en anglais** ; docs en français.
- Validation d'entrée avec **Zod** à la frontière des routes. Erreurs métier via `ApiError` ; `handleApiError` logue seulement les 500 inattendus.
- Logs via `src/lib/logger.ts` (JSON, remonte à Sentry sur `error`) — pas de `console.*` ad hoc.
- Tests **Vitest** colocalisés (`*.test.ts`), **sans base de données** et avec appels LLM **mockés**. `npm run test`.
- Migrations par `drizzle-kit generate` ; certaines (`0027`, `0028`) ont été écrites à la main. Ne jamais renuméroter une migration déjà appliquée sans suivre la procédure notée dans la fiche du chantier.
- **Règle permanente des verticales** : une verticale n'ajoute pas de table et ne partitionne pas le modèle. Gardée par `src/db/schemaInvariants.test.ts`.

## Ce qui est du code mort ou masqué

À ne pas confondre avec du code vivant :

| Élément | Statut |
| :--- | :--- |
| `/assistant`, `assistantChat.ts`, `AssistantChat.tsx` | Fonctionnel, **caché** du menu |
| Adaptateurs LLM `gemini` (texte), `anthropic`, `groq` | Existent, **non opérationnels** |
| `narrative_state`, `scripts.beat_id`, `content_series.mode`, `content_series.framing` | Colonnes **conservées, jamais lues** (ancien rédacteur en chef) |
| `scripts.promisesMade`, `promiseHonored`, `promiseMatch`, `narrativeKind` ; `calendar_entries.kind`, `narrative_kind` | **Lues et écrites** depuis le fil narratif (`docs/SPEC_FIL_NARRATIF.md`) |
| Instagram (`social/instagram.ts`), table `inspiration_videos` | Résidus d’avant la fin de la vidéo et des autres réseaux : à vérifier avant de les croire vivants |
| `src/lib/verticals/types.ts` | Seul reste du registre de verticales (`users.vertical` ne choisit plus aucun parcours) |
| `/scripts/[id]` | Ne sert plus qu'aux scripts **sans créneau** (importés, libres) ; sinon redirige vers `/calendar` |
| Prompt V3 (`generateScript.ts`, `prompts.ts`) | Ne sert plus qu'aux **posts libres sans série** |
