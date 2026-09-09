# Connecteurs Notion et Linear — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quelqu'un crée son compte avec Notion ou avec Linear depuis `/login`, choisit jusqu'à 5 pages Notion ou projets Linear qui deviennent ses sujets, et leur contenu entre dans le corpus comme matière ordinaire — exactement le parcours GitHub existant, avec sa plateforme.

**Architecture:** Trois généralisations d'abord, deux fournisseurs ensuite. (1) `github_accounts` devient `oauth_accounts`, une table d'identité tierce multi-fournisseurs avec rafraîchissement de jeton. (2) Un contrat `OAuthIdentityProvider` et son registre, dont GitHub devient un adaptateur à comportement constant. (3) Une route de candidats et un sélecteur génériques, adossés au `listCandidates` que le contrat `SourceConnector` expose déjà. Les connecteurs Notion et Linear sont ensuite deux petits modules. Rien en aval de l'ingestion ne distingue une page Notion d'un `.md` de dépôt.

**Tech Stack:** Next.js 16.2 (App Router), React 19.2, Drizzle 0.45 / PostgreSQL, Zod 4, Vitest (node, `fetch` mocké, aucune base requise).

**Spec:** `docs/SPEC_CONNECTEURS_ET_SUJETS.md`

## Global Constraints

- **AGENTS.md** : ce Next.js diffère des versions connues. Lire le guide pertinent dans `node_modules/next/dist/docs/` avant d'écrire du code de route ou de composant.
- **Langue** : commentaires, messages d'erreur utilisateur et libellés UI en français. Le code (identifiants, types) en anglais.
- **Tests** : `npm run test` ne doit jamais requérir de base de données ni de clé d'API. Toute logique testée est extraite en fonction pure.
- **Sécurité** : toute route hors `start`/`callback` passe par `requireUserId()` et filtre sur `userId`.
- **Comportement GitHub constant** : aucune régression visible. Le parcours GitHub, ses routes `/api/auth/github/*` et `RepoPicker` continuent de fonctionner à l'identique — les URL de callback sont déjà déposées chez GitHub et ne doivent pas changer.
- **Une verticale n'ajoute pas de table** (`ARCHITECTURE_VERTICALES.md` chantier 4, gardé par `src/db/schemaInvariants.test.ts`). Le spécifique d'un fournisseur passe par `materialSources.config`.
- **Versions d'API à confirmer au moment d'écrire** : l'en-tête `Notion-Version` et les noms de champs GraphQL Linear doivent être vérifiés contre la documentation en vigueur, pas recopiés de ce plan.
- **Jetons expirants** : Notion et Linear périment tous les deux (Linear : 24 h). Aucun appel API ne lit `accessToken` directement — tout passe par `getValidProviderAccessToken`.

---

### Task 1 : Schéma et migration de `github_accounts` vers `oauth_accounts`

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0028_<nom>.sql` + snapshot + entrée de journal, **écrits à la main**
- Modify: `src/db/schemaInvariants.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: table `oauthAccounts` ; `materialSourceTypeEnum` gagne `notion_page` et `linear_project`.

- [ ] **Step 1 : Remplacer `githubAccounts` par `oauthAccounts` dans `src/db/schema.ts`**

```ts
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // Pas un pgEnum : la liste des fournisseurs vit dans src/lib/oauth/registry.ts, et en ajouter
    // un ne doit pas coûter une migration.
    provider: text("provider").notNull(),
    providerUserId: text("provider_user_id").notNull(),
    login: text("login").notNull(),
    name: text("name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    accessToken: text("access_token").notNull(),
    // Nuls pour GitHub, dont le jeton d'OAuth App classique ne périme pas. Renseignés pour Notion
    // et Linear (SPEC_CONNECTEURS_ET_SUJETS.md §7.4).
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    scope: text("scope").notNull(),
    // Spécifique fournisseur : workspaceId Notion, domaine de boutique Shopify demain.
    config: jsonb("config").notNull().default({}),
    connectedAt: timestamp("connected_at").notNull().defaultNow(),
  },
  // L'unicité passe de `user_id` seul à ces deux contraintes : un compte peut désormais avoir
  // plusieurs identités tierces, mais une seule par fournisseur.
  (t) => [unique().on(t.provider, t.providerUserId), unique().on(t.userId, t.provider)]
);
```

- [ ] **Step 2 : Ajouter les deux types de source**

```ts
export const materialSourceTypeEnum = pgEnum("material_source_type", [
  "github_repo",
  "notion_page",
  "linear_project",
]);
```

- [ ] **Step 3 : Écrire la migration `0028` à la main**

`drizzle-kit generate` **exige un TTY** pour arbitrer un renommage et échoue dans un shell non
interactif (`ARCHITECTURE_VERTICALES.md` chantier 3). Écrire le `.sql`, le snapshot et l'entrée de
journal soi-même. Le SQL, dans cet ordre :

```sql
ALTER TABLE "github_accounts" RENAME TO "oauth_accounts";
ALTER TABLE "oauth_accounts" RENAME COLUMN "github_user_id" TO "provider_user_id";
ALTER TABLE "oauth_accounts" ADD COLUMN "provider" text;
UPDATE "oauth_accounts" SET "provider" = 'github';
ALTER TABLE "oauth_accounts" ALTER COLUMN "provider" SET NOT NULL;
ALTER TABLE "oauth_accounts" ADD COLUMN "refresh_token" text;
ALTER TABLE "oauth_accounts" ADD COLUMN "access_token_expires_at" timestamp;
ALTER TABLE "oauth_accounts" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;
-- L'ancienne unicité sur user_id interdirait une deuxième identité sur le même compte.
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "github_accounts_user_id_unique";
ALTER TABLE "oauth_accounts" DROP CONSTRAINT "github_accounts_github_user_id_unique";
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_provider_provider_user_id_unique" UNIQUE("provider","provider_user_id");
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_provider_unique" UNIQUE("user_id","provider");
ALTER TYPE "public"."material_source_type" ADD VALUE 'notion_page';
ALTER TYPE "public"."material_source_type" ADD VALUE 'linear_project';
```

Vérifier les **noms réels des contraintes** en base avant d'écrire les `DROP` — ils sont générés par
Drizzle et le plan les suppose.

- [ ] **Step 4 : Vérifier la migration**

`npm run db:migrate`, puis `npm run db:generate` doit répondre « No schema changes, nothing to
migrate ». Un snapshot écrit à la main qui diverge du schéma ne casse pas cette migration-ci mais la
**suivante**. Vérifier aussi en base que la ligne GitHub existante a bien survécu avec
`provider = 'github'` — c'est ce qui prouve un renommage et non un `DROP` suivi d'un `CREATE`.

---

### Task 2 : Contrat et registre des fournisseurs d'identité

**Files:**
- Create: `src/lib/oauth/types.ts`, `src/lib/oauth/github.ts`, `src/lib/oauth/registry.ts`, `src/lib/oauth/registry.test.ts`
- Modify: `src/lib/github/client.ts` (aucun changement de comportement, seulement ce que l'adaptateur consomme)

**Interfaces:**
- Consumes: `src/lib/github/client.ts`.
- Produces: `OAuthIdentityProvider`, `OAuthIdentity`, `ProviderTokens`, `getIdentityProvider`, `listConfiguredProviders`.

- [ ] **Step 1 : Écrire le contrat dans `types.ts`**

Calqué sur `SourceConnector` : ce qui est spécifique à un fournisseur vit dans son module, le cœur
ne connaît que ce contrat.

```ts
export interface OAuthIdentity {
  providerUserId: string;
  login: string;              // identifiant lisible, stocké dans oauthAccounts.login
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  /** Non null SEULEMENT si le fournisseur le donne comme vérifié — condition du rattachement à un
   *  compte existant. Un email non vérifié vaut null, jamais la chaîne. */
  email: string | null;
  /** Écrit dans oauthAccounts.config, relu par ce fournisseur seul. */
  config?: Record<string, unknown>;
}

export interface ProviderTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;   // undefined = ne périme pas (GitHub)
  scope: string;
}

export interface OAuthIdentityProvider {
  id: string;                 // "github" | "notion" | "linear"
  displayName: string;        // "Notion" — affiché sur /login
  isConfigured(): boolean;    // variables d'environnement présentes
  buildAuthorizeUrl(state: string): string;
  exchangeCode(code: string, state: string): Promise<{ tokens: ProviderTokens; identity: OAuthIdentity }>;
  /** Absent = ce fournisseur ne périme pas. */
  refreshTokens?(refreshToken: string): Promise<ProviderTokens>;
}
```

- [ ] **Step 2 : `github.ts` — adaptateur autour de l'existant**

Ne réécrit rien : appelle `buildAuthorizeUrl`, `exchangeCode` et `fetchViewer` de
`src/lib/github/client.ts` et traduit `GithubViewer` en `OAuthIdentity`. Pas de `refreshTokens`.
`isConfigured` délègue à `isGithubConfigured`.

- [ ] **Step 3 : `registry.ts` + son test**

```ts
const providers: Record<string, OAuthIdentityProvider> = { github: githubIdentityProvider, notion: ..., linear: ... };
export function getIdentityProvider(id: string): OAuthIdentityProvider | null;
export function listConfiguredProviders(): Array<{ id: string; displayName: string }>;
```

Test : chaque fournisseur enregistré expose un `id` égal à sa clé, et `listConfiguredProviders`
n'en renvoie aucun quand l'environnement est vide.

---

### Task 3 : Service de comptes tiers

**Files:**
- Create: `src/lib/services/oauthAccountService.ts`, `src/lib/services/oauthAccountService.test.ts`
- Delete: `src/lib/services/githubAuthService.ts`, `src/lib/services/githubAuthService.test.ts`
- Modify: `src/app/api/profile/route.ts`, `src/lib/services/devOnboardingContext.ts`

**Interfaces:**
- Consumes: `oauthAccounts`, registre de Task 2.
- Produces: `decideAccountResolution` (inchangée), `resolveOAuthAccount`, `getValidProviderAccessToken`, `getConnectedProvider`.

- [ ] **Step 1 : Déplacer `decideAccountResolution` telle quelle**

La fonction pure et son test migrent sans modification : la règle de résolution ne dépend pas du
fournisseur. Seul le message d'email non vérifié devient paramétré par le nom du fournisseur.

- [ ] **Step 2 : `resolveOAuthAccount(providerId, identity, tokens)`**

Généralise `resolveGithubAccount` : même ordre de décision, `eq(oauthAccounts.providerUserId, ...)`
devient `and(eq(provider), eq(providerUserId))`. La branche `create` pose `vertical` selon le
fournisseur (voir Task 8) ; la branche `link` ne touche **jamais** à `vertical`.

- [ ] **Step 3 : `getValidProviderAccessToken(userId, providerId)`**

Réplique explicite de `getValidSocialAccessToken` (`socialConnectionService.ts`), marge
d'expiration identique (60 s). Sans `refreshTokens` ou sans jeton de rafraîchissement, lève une
`ApiError(409)` demandant de reconnecter. **Tout** accès à un jeton passe par là.

---

### Task 4 : Routes OAuth génériques

**Files:**
- Create: `src/app/api/auth/oauth/[provider]/start/route.ts`, `src/app/api/auth/oauth/[provider]/callback/route.ts`, `src/app/api/auth/oauth/providers/route.ts`
- Modify: `src/app/api/auth/github/start/route.ts`, `src/app/api/auth/github/callback/route.ts`, `src/app/api/auth/github/status/route.ts`

**Interfaces:**
- Consumes: Tasks 2 et 3.
- Produces: `GET /api/auth/oauth/[provider]/start|callback`, `GET /api/auth/oauth/providers`.

- [ ] **Step 1 : Extraire les deux handlers dans des fonctions paramétrées par `providerId`**

Reprendre à l'identique la logique de `src/app/api/auth/github/*` : cookie de state
(`oauth_state_<provider>`, 32 octets, `httpOnly`, `sameSite: lax`, 600 s), garde-fou de
`enforceRateLimit("oauth-signup", ip, 10, 3600)` — une connexion tierce peut créer un compte, c'est
une porte de création massive —, `setSessionCookie`, redirection vers `/onboarding` si `isNew`
sinon `/calendar`.

Pas de `requireUserId()` : ce sont des portes d'entrée.

- [ ] **Step 2 : Les routes GitHub deviennent des enveloppes**

Les URL de callback GitHub sont déjà déposées côté GitHub, elles ne doivent pas bouger :

```ts
export const GET = (request: NextRequest) => handleOAuthCallback(request, "github");
```

`GITHUB_OAUTH_REDIRECT_URI` reste la source de vérité pour GitHub ; les autres fournisseurs
dérivent `${APP_URL}/api/auth/oauth/<provider>/callback`.

- [ ] **Step 3 : `/api/auth/oauth/providers`**

Remplace `/api/auth/github/status` en généralisant : renvoie `listConfiguredProviders()`.
`export const dynamic = "force-dynamic"` — la route ne lit que `process.env` et serait sinon figée
au build. Conserver `/api/auth/github/status` en alias tant que `/login` n'est pas migrée.

---

### Task 5 : Connecteur Notion

**Files:**
- Create: `src/lib/notion/client.ts`, `src/lib/connectors/notionMapping.ts`, `src/lib/connectors/notionMapping.test.ts`, `src/lib/connectors/notion.ts`, `src/lib/oauth/notion.ts`
- Modify: `src/lib/connectors/registry.ts`, `src/lib/validation.ts`

**Interfaces:**
- Consumes: contrats de Tasks 2 et 3.
- Produces: `notionConnector` (`type: "notion_page"`), `notionIdentityProvider`.

- [ ] **Step 1 : Client HTTP**

Autorisation : `https://api.notion.com/v1/oauth/authorize` avec `client_id`, `response_type=code`,
`owner=user`, `redirect_uri`, `state`. Échange : `POST https://api.notion.com/v1/oauth/token`, en
**Basic auth** `base64(client_id:client_secret)`, corps `{ grant_type, code, redirect_uri }`.
La réponse porte `access_token`, `refresh_token`, `workspace_id`, `workspace_name`, `bot_id` et
`owner.user.person.email` — c'est de là que vient l'identité.

Toute requête API porte `Authorization: Bearer`, `Notion-Version: <version à confirmer>`.
Traduire le 401 en `NotionAuthError` (→ `needs_reconnect`) et le 429 en `ConnectorRateLimitError`,
sur le modèle de `GithubAuthError` / `GithubRateLimitError`.

- [ ] **Step 2 : Candidats**

`POST /v1/search` avec `filter: { property: "object", value: "page" }`, puis la même chose pour
`"database"`. Ne garder que les objets **sans parent de type page** — ce sont les racines. Le titre
vient de `properties.title`. `externalId` = id de la page, `config` = `{ objectType: "page" | "database" }`.

Si la liste est vide, `listCandidates` renvoie un tableau vide et l'écran affiche le message dédié
au partage d'intégration (`SPEC_CONNECTEURS_ET_SUJETS.md` §4) — pas une page blanche.

- [ ] **Step 3 : Documents**

Pour une page : `GET /v1/blocks/{id}/children` en paginant, récursivement sur les blocs `child_page`,
plafonné par une nouvelle constante `MAX_NOTION_BLOCKS` dans `src/lib/validation.ts` (mettre
`truncated: true` au-delà, comme l'arbre GitHub tronqué). Pour une base : une entrée = un document.
`externalRef` = id du bloc ou de la page, `externalChecksum` = `last_edited_time`.

- [ ] **Step 4 : Rendu en texte, fonction pure et testée**

`notionMapping.ts` porte la traduction blocs → texte (paragraphes, titres, listes, `to_do`, code)
et `toCandidate`. C'est la seule partie testable sans réseau, donc la seule testée.

---

### Task 6 : Connecteur Linear

**Files:**
- Create: `src/lib/linear/client.ts`, `src/lib/connectors/linearMapping.ts`, `src/lib/connectors/linearMapping.test.ts`, `src/lib/connectors/linear.ts`, `src/lib/oauth/linear.ts`
- Modify: `src/lib/connectors/registry.ts`, `src/lib/validation.ts`

**Interfaces:**
- Produces: `linearConnector` (`type: "linear_project"`), `linearIdentityProvider`.

- [ ] **Step 1 : Client GraphQL**

Autorisation : `https://linear.app/oauth/authorize`, `scope=read`. Échange :
`POST https://api.linear.app/oauth/token` en form-encoded. **Le jeton vaut 24 heures** — renseigner
`expiresAt` et implémenter `refreshTokens`, sans quoi tout casse le lendemain.

API : `POST https://api.linear.app/graphql`, `Authorization: Bearer`. Un seul helper `gql<T>()` qui
lève sur `errors[]` non vide — une réponse GraphQL en erreur a un statut 200.

- [ ] **Step 2 : Identité**

`viewer { id name email displayName avatarUrl }`. `login` = `displayName`.

- [ ] **Step 3 : Candidats et documents**

Candidats : `projects { nodes { id name description updatedAt } }`.

Documents d'un projet, trois familles, chacune un document distinct :
- la **description** du projet ;
- les **project updates**, concaténés en un journal ordonné — c'est l'équivalent du journal de
  commits, et la meilleure matière de ce connecteur ;
- les **issues terminées**, titre et description, plafonnées par `MAX_LINEAR_ISSUES`.

`externalChecksum` = `updatedAt` de l'objet. Le curseur de source est le `updatedAt` du projet.

**Les noms exacts des champs GraphQL sont à vérifier contre le schéma Linear** avant d'écrire :
ce plan les donne de mémoire.

- [ ] **Step 4 : Fonction pure et testée**

`linearMapping.ts` : construction du journal d'updates et `toCandidate`. Le reste n'est pas testé.

---

### Task 7 : Route de candidats et sélecteur génériques

**Files:**
- Create: `src/app/api/connectors/[provider]/candidates/route.ts`, `src/components/SourcePicker.tsx`
- Modify: `src/lib/apiClient.ts`, `src/app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `listCandidates`, `createSourcesFromCandidates`, `listConnectedExternalIds` (tous existants).
- Produces: `GET|POST /api/connectors/[provider]/candidates`, `<SourcePicker provider=... />`.

- [ ] **Step 1 : La route**

Transposition directe de `/api/github/repos`, en résolvant le connecteur par le registre au lieu de
l'importer. `GET` renvoie `{ candidates: [{ externalId, label, subjectName, subjectDescription, hint, alreadyConnected }] }`
où `hint` est une ligne de contexte que le connecteur compose depuis son `meta` — c'est ce qui
évite au sélecteur générique de connaître les métadonnées d'un fournisseur.

`POST` appelle `assertReady` **avant** toute écriture, puis `createSourcesFromCandidates`.
Traduire `ConnectorRateLimitError` en 429, comme la route GitHub.

- [ ] **Step 2 : Le sélecteur**

`SourcePicker` est `RepoPicker` débarrassé de GitHub : mêmes états (chargement, liste, résultats,
vide), mêmes plafonds `MAX_PRODUCTS`, mais libellés reçus en props (`emptyMessage`, `connectLabel`,
`footnote`) fournis par le fournisseur.

**`RepoPicker` et `/api/github/repos` ne sont pas supprimés** : GitHub garde sa route et son écran,
ce que l'architecture autorise explicitement (chantier 1). Les migrer serait un refactor à risque
sans gain fonctionnel — à faire plus tard, séparément, si les deux écrans divergent.

- [ ] **Step 3 : Paramètres > Sujets**

`CatalogueTab` affiche aujourd'hui une carte « Ajouter depuis GitHub » conditionnée à
`githubConnected`. Généraliser : une carte par fournisseur connecté, alimentée par un
`connectedProviders` ajouté à `GET /api/profile`.

---

### Task 8 : Onboarding et page de connexion

**Files:**
- Modify: `src/lib/verticals/types.ts`, `src/lib/verticals/dev.tsx`, `src/lib/verticals/registry.ts`, `src/lib/verticals/server.ts`
- Modify: `src/lib/services/devOnboardingContext.ts`, `src/lib/llm/onboardingChat.ts`
- Modify: `src/app/login/page.tsx`, `src/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: Tasks 2, 3, 7.
- Produces: parcours d'onboarding paramétré par le fournisseur connecté.

- [ ] **Step 1 : Trancher le §7.2 de la spec**

Point resté ouvert : ajouter `artisan` et `entrepreneur` à `verticalEnum`, ou laisser tout le monde
sur `dev`. **Recommandation du document** : les ajouter, les trois verticales pointant vers le même
parcours. À faire dans la migration de Task 1 si la décision est prise avant.

- [ ] **Step 2 : Le parcours devient une fabrique**

`dev.tsx` devient `sourceFirst.tsx` : mêmes trois étapes (sélection, chat, réseaux), mais le
sélecteur est choisi d'après le **fournisseur réellement connecté**, pas d'après la verticale — un
compte `dev` peut venir de GitHub ou de Linear. Le `OnboardingStepContext` gagne donc un champ
`connectedProvider: string | null`, alimenté par `GET /api/profile`.

L'étape GitHub continue de rendre `RepoPicker` ; Notion et Linear rendent `SourcePicker`.

- [ ] **Step 3 : Généraliser le contexte de chat**

`buildDevOnboardingContext` devient `buildConnectedOnboardingContext` : lit `oauthAccounts` au lieu
de `githubAccounts`, et prend le **premier document ingéré** de chaque source au lieu de chercher
`README.md` en dur.

Côté prompt, `DEV_SYSTEM_PROMPT` est rédigé pour une développeuse et interdit la question du
matériel de production. Le paramétrer par le fournisseur : le nom de la plateforme, et un
indicateur porté par le fournisseur disant si la question du matériel a du sens (non pour GitHub,
Notion et Linear ; **oui** pour Etsy et Shopify demain — un artisan filme ses pièces).

- [ ] **Step 4 : `/login`**

Le bouton GitHub en dur devient une boucle sur `GET /api/auth/oauth/providers`, chaque fournisseur
portant son libellé et son icône. Le séparateur « ou » ne s'affiche que s'il y a au moins un
fournisseur configuré — comportement actuel préservé.

---

### Task 9 : Environnement et documentation

**Files:**
- Modify: `.env.example`, `CLAUDE.md`, `docs/TECH.md`, `docs/ARCHITECTURE_VERTICALES.md`, `docs/PRODUCT.md`, `docs/SPEC_CONNECTEURS_ET_SUJETS.md`

- [ ] **Step 1 : Variables d'environnement**

```
# Notion (intégration publique) — https://www.notion.so/my-integrations
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
# Linear (OAuth application) — https://linear.app/settings/api/applications
LINEAR_CLIENT_ID=
LINEAR_CLIENT_SECRET=
```

Même philosophie que GitHub et Stripe : **absentes, le bouton n'apparaît pas** et le reste de l'app
fonctionne. Redirect URI à déposer des deux côtés : `${APP_URL}/api/auth/oauth/<provider>/callback`.

- [ ] **Step 2 : Documentation**

- `CLAUDE.md` : la section Configuration mentionne les deux nouvelles paires de variables.
- `docs/TECH.md` §8 : `github_accounts` n'existe plus, décrire `oauth_accounts` et le registre.
- `docs/ARCHITECTURE_VERTICALES.md` chantier 1 : « Ajouter Notion » n'est plus hypothétique.
- `docs/PRODUCT.md` : les deux nouvelles portes d'entrée.
- `docs/SPEC_CONNECTEURS_ET_SUJETS.md` : passer le §11 en « implémenté » pour Notion et Linear.

---

## Vérification de bout en bout

Aucune de ces vérifications n'est couverte par `npm run test`, qui ne touche ni base ni réseau.

- [ ] `npm run test` et `npm run lint` passent.
- [ ] `npm run db:generate` répond « No schema changes » après la migration de Task 1.
- [ ] L'utilisateur GitHub existant en base de dev a survécu avec `provider = 'github'`.
- [ ] **Parcours GitHub inchangé** : connexion, sélection de dépôts, resynchronisation. C'est la
      régression la plus probable de ce chantier.
- [ ] Inscription Notion depuis `/login` sur un compte neuf → onboarding → sélection de pages →
      la matière apparaît dans le corpus du sujet.
- [ ] Inscription Linear, même parcours.
- [ ] Connexion avec une identité déjà liée → `/calendar`, pas de doublon en base.
- [ ] Un compte email/mot de passe existant qui se connecte avec la même adresse vérifiée est
      **rattaché**, pas dupliqué, et sa `vertical` n'est pas modifiée.
- [ ] Jeton Linear expiré (attendre 24 h ou forcer `access_token_expires_at` dans le passé) → une
      resynchronisation le rafraîchit silencieusement.
- [ ] Intégration Notion sans page partagée → message explicatif, pas d'écran vide.
- [ ] Débrancher une source supprime ses documents miroir.
