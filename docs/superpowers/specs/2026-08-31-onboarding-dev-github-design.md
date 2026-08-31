# Onboarding dev : identité GitHub, repos comme sujets, matière ingérée

> Design validé le 2026-08-31. Branche `feature/app-for-dev`.
> Sert la ligne « Sources de matière connectées […] dépôt git » de `docs/PRODUCT.md` §4, et
> la cible prioritaire de `docs/PRODUCT.md` §2.1 (« ceux qui ont déjà de la matière écrite »).

## 1. Problème

Le corpus est ce dont dépend toute la promesse du produit — ne jamais inventer, ne jamais répéter
(`docs/SPEC_MATIERE_EDITEUR.md` §1.1). Aujourd'hui il se remplit à la main : collage de texte,
fichier `.md`, ou interview-chat. Pour un développeur, la matière existe déjà et elle est
structurée : README, specs, ADR, journal de bord, et l'historique de commits qui raconte
littéralement la chronologie du projet. Lui demander de la coller à la main, c'est lui demander de
recopier ce que GitHub tient déjà à jour.

Par ailleurs l'onboarding actuel commence par découvrir *qui est cette personne et ce qu'elle fait*.
Sur un compte GitHub, l'essentiel de cette réponse est déjà lisible : nom, bio, langages, projets,
README. Poser les mêmes questions serait de la friction pure.

## 2. Décisions de cadrage

| Question | Décision | Conséquence |
| :--- | :--- | :--- |
| Rôle du OAuth GitHub | **Identité du compte** — « Continuer avec GitHub » crée le compte et pose la session | `users.passwordHash` devient nullable, table d'identités |
| Portée | **Deux parcours en parallèle** — signup GitHub → parcours dev ; signup email → parcours actuel, inchangé | Colonne `users.onboardingTrack` |
| Matière ingérée | **Un document par `.md`, plus un document « journal de commits »** | Résumé LLM et citations pointent un fichier précis |
| Scope GitHub | **Repos publics uniquement** | Pas de scope `repo`, consentement léger |
| Fraîcheur | **Bouton « Resynchroniser » manuel** | `syncCursor` + `lastSyncedAt`, pas de cron |
| Questions restantes | **Chat court, même moteur, prompt dédié dev** | Deuxième prompt système, pas un deuxième moteur |

Modélisation retenue : **une table de sources séparée**, pas des colonnes GitHub sur `products`.
Un sujet est un objet éditorial, un repo est une de ses sources — mettre `githubRepoId` sur
`products` figerait « un sujet = un repo » et polluerait une table centrale de plomberie de
connecteur. Une table dédiée donne gratuitement le sujet nourri par deux repos, ou par un repo *et*
des notes collées.

En revanche **pas d'interface `SourceConnector` ni de registre** à la manière de `socialProviders`.
Un connecteur Obsidian n'a ni branche, ni commits, ni owner : écrire le contrat à partir d'un seul
implémenteur, c'est le deviner. GitHub s'écrit comme un module simple (`src/lib/github/`) ; le
contrat s'extraira quand un deuxième connecteur donnera la matière pour le dessiner.

## 3. Modèle de données

Trois migrations Drizzle (`npm run db:generate`), toutes rétrocompatibles avec les comptes existants.

### 3.1 Identité

```ts
// users : passwordHash devient nullable — un compte GitHub n'a pas de mot de passe.
passwordHash: text("password_hash"),

export const onboardingTrackEnum = pgEnum("onboarding_track", ["creator", "dev"]);
// users : quel onboarding s'affiche, décidé au signup et jamais recalculé.
onboardingTrack: onboardingTrackEnum("onboarding_track").notNull().default("creator"),

export const githubAccounts = pgTable("github_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  githubUserId: text("github_user_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  // Token d'OAuth App classique : pas d'expiration, pas de refresh token (sauf si les
  // "expiring tokens" sont activés sur l'app — non prévu ici). Stocké pour le quota
  // authentifié (5000 req/h contre 60 en anonyme), pas pour un accès privilégié : le scope
  // demandé ne donne accès qu'à ce qui est déjà public.
  accessToken: text("access_token").notNull(),
  scope: text("scope").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});
```

`passwordHash` nullable impose une vérification explicite côté `POST /api/auth/login` : un compte
sans hash ne peut pas se connecter par mot de passe et doit recevoir un message qui l'oriente vers
GitHub, jamais un « mot de passe incorrect » trompeur.

### 3.2 Sources de matière

```ts
export const materialSourceTypeEnum = pgEnum("material_source_type", ["github_repo"]);
export const materialSourceStatusEnum = pgEnum("material_source_status", ["ok", "error", "needs_reconnect"]);

export const materialSources = pgTable(
  "material_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // CASCADE, contrairement à sourceMaterials.productId qui est SET NULL : une source sans
    // sujet n'a pas de sens (on ne saurait plus quoi resynchroniser ni vers où), alors qu'un
    // document de matière orphelin reste de la matière de niveau marque.
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    type: materialSourceTypeEnum("type").notNull(),
    externalId: text("external_id").notNull(),      // id numérique du repo GitHub
    label: text("label").notNull(),                 // "owner/repo", affiché tel quel
    config: jsonb("config").notNull().default({}),  // { defaultBranch }
    syncCursor: text("sync_cursor"),                // SHA du dernier commit vu
    lastSyncedAt: timestamp("last_synced_at"),
    status: materialSourceStatusEnum("status").notNull().default("ok"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.type, t.externalId)]
);
```

La contrainte unique porte sur `(userId, type, externalId)` et non sur `productId` : le même repo ne
peut pas être branché deux fois par le même utilisateur, mais deux utilisateurs différents peuvent
suivre le même repo public.

### 3.3 Documents ingérés

```ts
// sourceMaterialKindEnum gagne "connector".
export const sourceMaterialKindEnum = pgEnum("source_material_kind", ["paste", "file", "interview", "connector"]);

// sourceMaterials gagne trois colonnes :
// CASCADE, et c'est une déviation assumée de la convention du repo (products.id est en
// SET NULL depuis sourceMaterials, scripts, brandAssets, contentSeries). Un document
// connecté est le MIROIR d'une source, pas de la matière rédigée : l'orpheliner à la
// suppression du sujet le ferait basculer en matière de niveau marque (productId null),
// donc injectée à CHAQUE génération sans sujet via getMaterialForSubject(userId, null).
// Cinquante .md d'un projet qu'on vient de supprimer empoisonneraient toutes les
// générations suivantes. Le contenu, lui, ne se perd pas : il est dans le repo.
sourceId: uuid("source_id").references(() => materialSources.id, { onDelete: "cascade" }),
// Identifiant du document DANS sa source : chemin du fichier ("docs/SPEC.md"), ou la
// valeur réservée "__commits__" pour le journal. Null pour toute matière non connectée.
externalRef: text("external_ref"),
// Blob SHA GitHub pour un fichier ; SHA du commit le plus récent pour le journal. C'est
// la comparaison de cette valeur qui rend le re-sync idempotent sans relire le contenu.
externalChecksum: text("external_checksum"),
```

Index partiel `unique(sourceId, externalRef) where source_id is not null` : un document par chemin
et par source, condition d'un upsert propre. Deux repos branchés sur le même sujet peuvent donc
avoir chacun leur `README.md` sans collision.

**Effet de bord à corriger dans la même migration :**

```ts
// sourceMaterialCitations.sourceMaterialId : cascade → set null.
sourceMaterialId: uuid("source_material_id").references(() => sourceMaterials.id, { onDelete: "set null" }),
```

Sans ce changement, la cascade ci-dessus effacerait aussi les citations des scripts déjà publiés qui
s'appuyaient sur ces documents. `sourceMaterialId` null est déjà un état de première classe —
`citationService.ts` l'écrit quand aucun document ne matche, `narrativeDirector.ts` le filtre,
`apiClient.ts` le type `string | null` : la traçabilité se dégrade proprement (l'extrait cité reste
lisible, il n'est simplement plus rattachable à un document) au lieu de disparaître. Aucun code
applicatif à modifier.

**Un document ingéré reste une matière strictement ordinaire.** Résumé (`summary`, backfill
paresseux), citations, injection à la génération, rattachement à une série : rien en aval ne
distingue un `.md` venu de GitHub d'un texte collé à la main. C'est le principal bénéfice de ce
découpage — la surface de code touchée s'arrête à l'ingestion.

## 4. Authentification GitHub

**OAuth App** (pas GitHub App), scope `read:user user:email`. Aucun scope `repo` : les repos publics
et leur contenu se lisent sans scope dédié ; le token authentifié ne sert qu'au quota horaire.
`public_repo` est explicitement **écarté** — il accorde l'écriture sur les repos publics, ce dont on
n'a aucun usage.

`user:email` est nécessaire et non négociable : `users.email` est `NOT NULL UNIQUE`, et `GET /user`
ne renvoie l'email que s'il est public sur le profil. On lit donc `GET /user/emails` et on retient
l'entrée `primary: true, verified: true`.

### 4.1 Routes

- `GET /api/auth/github/start` — **pas** de `requireUserId()` (c'est une porte d'entrée, pas une
  connexion de compte) ; pose un cookie `github_oauth_state` (32 octets hex, `httpOnly`, 600 s) et
  redirige vers `https://github.com/login/oauth/authorize`.
- `GET /api/auth/github/callback` — vérifie le state, échange le code contre un token
  (`POST https://github.com/login/oauth/access_token`, `Accept: application/json`), lit `/user` et
  `/user/emails`, résout le compte, pose la session, redirige.

Ces deux routes vivent dans `src/app/api/auth/github/` — segment statique, frère de `login`,
`logout`, `me`, `signup`, qui coexistent déjà avec le segment dynamique `[platform]`. Aucune
collision : le parcours social passe par `[platform]/connect` et `[platform]/callback`, et
`hasOAuthProvider("github")` reste `false`.

### 4.2 Résolution du compte

Dans l'ordre :

1. `github_accounts.githubUserId` connu → connexion sur ce compte.
2. Sinon, un `users.email` égal à l'email GitHub **primaire et vérifié** → on rattache l'identité à
   ce compte existant et on connecte. Le `onboardingTrack` n'est pas modifié : un utilisateur qui
   avait commencé en parcours créateur ne bascule pas parce qu'il s'est reconnecté autrement.
3. Sinon → création : `users` (`passwordHash: null`, `onboardingTrack: "dev"`) + `github_accounts`,
   redirection vers `/onboarding`.

Le rattachement du cas 2 n'est fait **que** sur un email vérifié par GitHub. Sur un email non
vérifié, n'importe qui pourrait revendiquer l'adresse d'un compte existant et en prendre le
contrôle : on répond alors 409 avec un message explicite plutôt que de lier.

Rate limit sur le callback (`enforceRateLimit("github-oauth", ip, 10, 60 * 60)`), même esprit que
`signup-ip`.

## 5. Le module GitHub — `src/lib/github/`

`client.ts` — appels bruts, aucune connaissance de la base. Même forme que
`src/lib/googleDrive/client.ts` : fonctions exportées, `fetch` nu, erreurs explicites.

| Fonction | Endpoint | Note |
| :--- | :--- | :--- |
| `exchangeCode(code)` | `POST /login/oauth/access_token` | |
| `fetchViewer(token)` | `GET /user` + `GET /user/emails` | email primaire vérifié |
| `listPublicRepos(token)` | `GET /user/repos?visibility=public&affiliation=owner&sort=pushed&per_page=100` | triés par activité récente |
| `fetchTree(token, full, branch)` | `GET /repos/{full}/git/trees/{branch}?recursive=1` | un appel pour tout l'arbre |
| `fetchBlob(token, full, sha)` | `GET /repos/{full}/git/blobs/{sha}`, `Accept: application/vnd.github.raw` | contenu direct, pas de base64 à décoder |
| `listCommits(token, full, branch)` | `GET /repos/{full}/commits?sha={branch}&per_page=100` | |

Ce qu'on retient d'un commit : son **nom** (titre du message) et sa **description** (corps du
message), plus la date et l'auteur. C'est là qu'est le « pourquoi » d'un devlog, et c'est
intégralement présent dans la réponse de l'endpoint de liste — un seul appel par repo, pas de
requête par commit. La liste des fichiers touchés n'est volontairement pas ingérée : elle n'est pas
dans cette réponse (il faudrait `GET /commits/{sha}` par commit) et n'apporte rien de racontable.

Toutes les requêtes portent `Accept: application/vnd.github+json`, `X-GitHub-Api-Version:
2022-11-28` et `Authorization: Bearer`. Un `403` accompagné de `x-ratelimit-remaining: 0` est traduit
en message dédié (« quota GitHub atteint, réessaie dans X minutes ») et non en erreur générique.

## 6. Ingestion et re-sync

`src/lib/services/githubSourceService.ts`.

### 6.1 Sélection des fichiers

Depuis l'arbre : `type === "blob"`, extension `.md` ou `.markdown`.

Exclusions — répertoires `node_modules/`, `dist/`, `build/`, `vendor/`, `.github/`, et fichiers
`LICENSE.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`. Ce sont des textes de
boilerplate identiques d'un projet à l'autre : ils ne portent aucune information sur *ce* projet et
ne feraient que diluer le corpus. `CHANGELOG.md` est **gardé** — c'est de la vraie matière datée.

Ordre : `README.md` racine d'abord, puis profondeur de chemin croissante, puis alphabétique.
Plafonds `MAX_GITHUB_MD_FILES = 50` et `MAX_GITHUB_FILE_BYTES = 100 * 1024` (dans
`src/lib/validation.ts`, avec les autres). Un fichier au-delà de la taille est **ignoré**, pas
tronqué : un `.md` coupé au milieu produirait de la matière trompeuse.

Si l'arbre revient `truncated: true` (repos très volumineux), on ingère ce qu'on a et on le signale
dans `lastError` sans passer `status` en `error` — c'est une ingestion partielle, pas un échec.

### 6.2 Journal de commits

Un `sourceMaterial` unique, `externalRef = "__commits__"`, `title = "Journal de commits — owner/repo"`,
`externalChecksum` = SHA du commit le plus récent. Corps en Markdown, du plus récent au plus ancien,
une entrée par commit : date, auteur, **nom** (première ligne du message) et **description** (reste
du message, tel quel).

```
## 2026-08-29 — alix
feat: contexte d'épisode dans l'éditeur

Le générateur ne savait pas où il en était dans la série : il reproposait
l'épisode 1 indéfiniment. On lui passe désormais les épisodes déjà écrits.
```

Les commits de merge sans description et les noms d'un seul mot (`wip`, `fix`, `up`) sont écartés à
l'écriture : ils n'apportent aucune information exploitable et occupent du contexte à la génération.

### 6.3 Idempotence

Pour chaque document candidat, upsert sur `(sourceId, externalRef)` :

| Situation | Action |
| :--- | :--- |
| Absent en base | INSERT, `summary` null → le backfill paresseux existant s'en chargera |
| Présent, `externalChecksum` identique | **Aucune écriture** — ni `rawText`, ni `summary`, ni `updatedAt` |
| Présent, checksum différent | UPDATE `rawText` + `externalChecksum`, **`summary` remis à null** |
| Chemin disparu du repo | **Laissé intact** |

Le passage de `summary` à null sur changement rompt volontairement la règle « l'édition manuelle
devient la source de vérité » de `sourceMaterialService.ts` : pour une source connectée, c'est le
repo qui fait foi, pas une édition locale. À documenter dans le commentaire de la colonne, sans quoi
la contradiction avec `backfillMaterialSummaries` paraîtra accidentelle.

Un chemin disparu est laissé en place parce que c'est de la matière passée toujours valable, et que
ses `sourceMaterialCitations` pointent dessus (`onDelete: cascade` — les supprimer effacerait la
traçabilité de scripts déjà publiés).

**Aucun appel LLM pendant l'ingestion.** Le résumé est déjà pris en charge par
`backfillMaterialSummaries`, déclenché à la première planification. Une ingestion est donc du fetch
et de l'écriture : elle tient dans une requête synchrone (~50 blobs + 2 appels, quelques secondes),
et n'a pas besoin de `after()`.

## 7. Parcours d'onboarding dev

Le OAuth ayant lieu à `/login`, l'onboarding démarre après. Trois étapes, même coquille visuelle que
l'existant (`src/app/onboarding/page.tsx`, sélection par `onboardingTrack`) :

**1 · Projets.** Liste des repos publics triés par activité récente : nom, description, langage
principal, date du dernier push. Sélection multiple plafonnée à `MAX_PRODUCTS` (5). À la validation :
un `product` par repo (`name` = nom du repo, `description` = description GitHub), un
`material_source`, puis ingestion. Progression affichée repo par repo — c'est l'étape la plus longue
du parcours, la masquer derrière un spinner unique donnerait l'impression d'un blocage.

**2 · Discussion courte.** `OnboardingChat` inchangé côté composant ; le tour de chat passe par le
même endpoint, qui choisit le prompt selon `onboardingTrack`.

**3 · Réseaux.** Strictement l'écran actuel.

### 7.1 Prompt dev

Nouveau `runDevOnboardingChatTurn` dans `src/lib/llm/onboardingChat.ts`, réutilisant
`updateOnboardingProfileTool` et `onboardingChatResultSchema` tels quels — c'est le même contrat de
sortie, seuls le prompt système et le contexte injecté changent.

Contexte fourni au premier tour : login, nom, bio GitHub ; pour chaque sujet retenu, nom,
description, langage, et les premières lignes du README ingéré.

Le prompt système diffère sur quatre points :

- `brandName` et `activityType` sont **pré-déduits** et proposés en récapitulatif à confirmer, pas
  demandés à froid.
- Le modèle n'a droit qu'à **deux ou trois questions** avant `complete=true` : ton, audience visée,
  temps disponible par semaine.
- Il ne demande **jamais** le matériel de production (`equipment`) : hors sujet pour du contenu de
  dev, majoritairement textuel.
- Plateformes suggérées par défaut orientées écrit et technique, mais toujours contraintes à
  `KNOWN_PLATFORM_KEYS`.

`complete` conserve exactement le même critère qu'aujourd'hui (`brandName`, `activityType`,
`weeklyTimeAvailable`, au moins une plateforme) : le parcours dev raccourcit le chemin, il ne baisse
pas la barre. `finalizeOnboarding` est inchangé — génération des rôles, angles, séries et objectifs
de fréquence identique.

## 8. Endpoints

| Route | Rôle |
| :--- | :--- |
| `GET /api/auth/github/start` | Entrée OAuth, sans session |
| `GET /api/auth/github/callback` | Échange, résolution de compte, session |
| `GET /api/github/repos` | Repos publics candidats |
| `POST /api/github/repos` | `{ repos: [{ externalId, fullName, defaultBranch, description }] }` → sujets + sources + ingestion |
| `GET /api/material-sources?productId=` | Sources d'un sujet, avec `lastSyncedAt` et `status` |
| `POST /api/material-sources/:id/sync` | Re-sync, renvoie `{ added, updated, unchanged }` |
| `DELETE /api/material-sources/:id` | Débranche la source **et supprime ses documents miroir** (§3.3). Confirmation explicite côté UI, en annonçant le nombre de documents concernés |

Toutes sauf `start`/`callback` passent par `requireUserId()` et filtrent sur `userId` — même
discipline que le reste des routes du repo.

## 9. UI

- `/login` : bouton « Continuer avec GitHub » au-dessus du formulaire, séparateur « ou ».
- Onboarding dev : nouveau composant `RepoPicker` pour l'étape 1 ; les étapes 2 et 3 réutilisent
  `OnboardingChat` et `ConnectionRow`.
- Écran matière d'un sujet : encart « Sources connectées » listant les `material_sources` avec
  `owner/repo`, date de dernière synchro, bouton **Resynchroniser**, et le résultat en clair après
  coup (« 3 fichiers mis à jour, 12 inchangés »). Un utilisateur qui ne voit pas ce qui a bougé
  reclique par doute.

## 10. Cas limites

| Cas | Comportement |
| :--- | :--- |
| Aucun repo public | Étape 1 affiche une explication et un lien vers la saisie manuelle de sujets — jamais un cul-de-sac |
| Repo sans aucun `.md` | Sujet et source créés quand même, seul le journal de commits est ingéré |
| Repo vide (zéro commit) | Source créée en `status: "error"`, message explicite, sujet conservé |
| Repo passé en privé ou supprimé | Re-sync → `status: "needs_reconnect"`, documents déjà ingérés conservés |
| Token révoqué côté GitHub | `401` → `status: "needs_reconnect"` sur toutes les sources, invite à se reconnecter |
| Quota GitHub atteint | Message dédié avec délai, `status` inchangé — ce n'est pas une panne de la source |
| Email GitHub non vérifié | 409 explicite, pas de rattachement à un compte existant (§4.2) |
| Login par mot de passe sur un compte GitHub | Message orientant vers GitHub, jamais « mot de passe incorrect » |
| Sujet supprimé | Source supprimée en cascade, documents miroir supprimés avec elle (§3.3). Les citations des scripts publiés survivent avec `sourceMaterialId` à null |
| Source débranchée puis le même repo rebranché | Aucune duplication : les documents de l'ancienne source ont été supprimés avec elle, le rebranchement ré-ingère depuis le repo et retrouve un corpus identique |
| Compte créateur existant qui se connecte via GitHub | Identité rattachée, `onboardingTrack` inchangé : il reste en parcours créateur et n'a pas d'écran de choix de repos. Brancher un repo depuis l'écran matière est une évolution, pas cette itération |

## 11. Tests

Vitest, `fetch` mocké, aucune base requise — la contrainte du repo (`npm run test`). Les cibles qui
valent le test sont la logique pure, pas la plomberie HTTP :

- `selectMarkdownFiles` : exclusions, plafonds, ordre, `truncated`.
- `buildCommitJournal` : format, filtrage des messages vides et des merges.
- `diffDocuments` : les quatre lignes du tableau §6.3, dont **l'absence d'écriture** sur checksum
  identique (c'est la propriété qui rend le bouton re-sync sûr à cliquer en boucle).
- `resolveGithubAccount` : les trois branches de §4.2, dont le refus sur email non vérifié.
- Le prompt dev : que `equipment` ne soit jamais demandé, et que le critère de `complete` reste
  celui du prompt existant.

## 12. Hors périmètre

Repos privés et GitHub App (accès par repo) — écartés au cadrage, réévaluables si le besoin remonte.
Re-sync automatique ou planifié : le repo n'a pas de cron, tout y est paresseux ou manuel. Ingestion
d'autre chose que du Markdown (code source, issues, pull requests). Organisations : seuls les repos
dont l'utilisateur est propriétaire (`affiliation=owner`) sont listés en v1. Extraction du contrat
`SourceConnector` — au deuxième connecteur (§2).

## 13. Configuration

`.env.example` gagne :

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
```

Sans ces variables, `/api/auth/github/start` échoue explicitement et le bouton `/login` n'est pas
rendu — le parcours email reste entièrement fonctionnel. Même philosophie que Stripe et les
credentials sociaux : l'app démarre sans, la feature est simplement absente.
