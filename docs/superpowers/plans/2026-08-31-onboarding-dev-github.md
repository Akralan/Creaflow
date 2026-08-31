# Onboarding dev via GitHub — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un développeur crée son compte avec GitHub, choisit jusqu'à 5 repos publics qui deviennent ses sujets, et leurs `.md` plus un journal de commits entrent dans le corpus comme matière ordinaire.

**Architecture:** Deuxième parcours d'onboarding en parallèle de l'actuel, aiguillé par `users.onboardingTrack`. L'identité GitHub vit dans `github_accounts`, les repos branchés dans une table `material_sources` distincte de `products`, et les documents ingérés sont des `sourceMaterials` normaux qualifiés par `(sourceId, externalRef, externalChecksum)`. Rien en aval de l'ingestion (résumé, citations, génération, séries) ne distingue un `.md` de repo d'un texte collé à la main.

**Tech Stack:** Next.js 16.2 (App Router, `after()`), React 19.2, Drizzle 0.45 / PostgreSQL, Zod 4, Vitest (node, `fetch` mocké, aucune base requise).

**Spec:** `docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md`

## Global Constraints

- **AGENTS.md** : ce Next.js diffère des versions connues. Lire le guide pertinent dans `node_modules/next/dist/docs/` avant d'écrire du code de route ou de composant.
- **Langue** : commentaires, messages d'erreur utilisateur, libellés UI et messages de commit en français. Le code (identifiants, types) en anglais, comme le reste du repo.
- **Tests** : `npm run test` (Vitest) ne doit jamais requérir de base de données ni de clé d'API. Toute logique testée est extraite en fonction pure ; le reste n'est pas testé unitairement.
- **Sécurité** : toute route hors `start`/`callback` passe par `requireUserId()` et filtre sur `userId`.
- **Plafonds** (valeurs exactes, dans `src/lib/validation.ts`) : `MAX_GITHUB_MD_FILES = 50`, `MAX_GITHUB_FILE_BYTES = 102400`, `MAX_GITHUB_COMMITS = 100`, `MAX_PRODUCTS = 5` (existant).
- **Scope OAuth** : `read:user user:email` exactement. Jamais `repo` ni `public_repo`.
- **En-têtes GitHub** : toute requête porte `Accept: application/vnd.github+json` (sauf les blobs : `application/vnd.github.raw`), `X-GitHub-Api-Version: 2022-11-28`, `Authorization: Bearer <token>`.
- **Pas d'appel LLM pendant l'ingestion** — divergence assumée avec `POST /api/materials` qui résume via `after()` : 50 fichiers feraient 50 appels. Le backfill paresseux (`backfillMaterialSummaries`, déclenché par `POST /api/narrative/plan`) s'en charge.

---

### Task 1 : Schéma et migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/lib/validation.ts`
- Create: `drizzle/00XX_<nom généré>.sql` (produit par `npm run db:generate`)

**Interfaces:**
- Consumes: rien.
- Produces: tables `githubAccounts`, `materialSources` ; colonnes `users.passwordHash` (nullable), `users.onboardingTrack`, `sourceMaterials.sourceId|externalRef|externalChecksum` ; enums `onboardingTrackEnum`, `materialSourceTypeEnum`, `materialSourceStatusEnum` ; `sourceMaterialKindEnum` gagne `"connector"`. Constantes `MAX_GITHUB_MD_FILES`, `MAX_GITHUB_FILE_BYTES`, `MAX_GITHUB_COMMITS`.

- [ ] **Step 1 : Ajouter les enums dans `src/db/schema.ts`**

À placer avec les autres `pgEnum`, avant les `pgTable`. Modifier `sourceMaterialKindEnum` existant (ligne ~52) :

```ts
export const sourceMaterialKindEnum = pgEnum("source_material_kind", ["paste", "file", "interview", "connector"]);

export const onboardingTrackEnum = pgEnum("onboarding_track", ["creator", "dev"]);
export const materialSourceTypeEnum = pgEnum("material_source_type", ["github_repo"]);
export const materialSourceStatusEnum = pgEnum("material_source_status", ["ok", "error", "needs_reconnect"]);
```

- [ ] **Step 2 : Rendre `passwordHash` nullable et ajouter le track**

Dans `users` (ligne ~73) :

```ts
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  // Nullable depuis l'arrivée de l'identité GitHub : un compte créé par OAuth n'a pas de mot de
  // passe. POST /api/auth/login doit donc refuser explicitement un compte sans hash plutôt que de
  // comparer contre null (cf. Task 5).
  passwordHash: text("password_hash"),
  // Quel onboarding s'affiche. Posé au signup, jamais recalculé — un compte créateur qui se
  // connecte plus tard via GitHub reste en parcours créateur.
  onboardingTrack: onboardingTrackEnum("onboarding_track").notNull().default("creator"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

- [ ] **Step 3 : Ajouter `githubAccounts`**

À placer juste après `googleDriveConnections` (regroupement des connexions externes) :

```ts
// Identité GitHub d'un compte (docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md §4).
// Distincte de socialConnections : GitHub n'est pas une plateforme de publication, c'est une source
// de matière et un fournisseur d'identité.
export const githubAccounts = pgTable("github_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  githubUserId: text("github_user_id").notNull().unique(),
  login: text("login").notNull(),
  name: text("name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  // Token d'OAuth App classique : pas d'expiration, pas de refresh token. Stocké pour le quota
  // authentifié (5000 req/h contre 60 en anonyme), pas pour un accès privilégié — le scope demandé
  // ne donne accès qu'à ce qui est déjà public.
  accessToken: text("access_token").notNull(),
  scope: text("scope").notNull(),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
});
```

- [ ] **Step 4 : Ajouter `materialSources`**

À placer juste après `sourceMaterials` :

```ts
// Source connectée alimentant le corpus d'un sujet (§3.2 de la spec). Table séparée plutôt que des
// colonnes sur products : un sujet est un objet éditorial, un repo une de ses sources — des colonnes
// GitHub sur products figeraient « un sujet = un repo » et pollueraient une table centrale.
export const materialSources = pgTable(
  "material_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // CASCADE, contrairement à sourceMaterials.productId qui est SET NULL : une source sans sujet
    // n'a pas de sens (on ne saurait plus quoi resynchroniser ni vers où).
    productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
    type: materialSourceTypeEnum("type").notNull(),
    externalId: text("external_id").notNull(), // id numérique du repo GitHub
    label: text("label").notNull(),            // "owner/repo", affiché tel quel
    config: jsonb("config").notNull().default({}), // { defaultBranch: string }
    syncCursor: text("sync_cursor"),           // SHA du commit le plus récent vu
    lastSyncedAt: timestamp("last_synced_at"),
    status: materialSourceStatusEnum("status").notNull().default("ok"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  // Porte sur externalId et non productId : le même repo ne peut pas être branché deux fois par le
  // même utilisateur, mais deux utilisateurs peuvent suivre le même repo public.
  (t) => [unique().on(t.userId, t.type, t.externalId)]
);
```

- [ ] **Step 5 : Ajouter les trois colonnes sur `sourceMaterials`**

Dans `sourceMaterials`, après `summary` :

```ts
  // CASCADE, et c'est une déviation assumée de la convention du repo (products.id est en SET NULL
  // depuis sourceMaterials, scripts, brandAssets, contentSeries). Un document connecté est le MIROIR
  // d'une source, pas de la matière rédigée : l'orpheliner à la suppression du sujet le ferait
  // basculer en matière de niveau marque (productId null), donc injectée à CHAQUE génération sans
  // sujet via getMaterialForSubject(userId, null). Cinquante .md d'un projet supprimé
  // empoisonneraient toutes les générations suivantes. Le contenu ne se perd pas : il est dans le repo.
  sourceId: uuid("source_id").references(() => materialSources.id, { onDelete: "cascade" }),
  // Identifiant du document DANS sa source : chemin du fichier ("docs/SPEC.md"), ou la valeur
  // réservée "__commits__" pour le journal. Null pour toute matière non connectée.
  externalRef: text("external_ref"),
  // Blob SHA GitHub pour un fichier, SHA du commit le plus récent pour le journal. C'est la
  // comparaison de cette valeur qui rend le re-sync idempotent sans relire le contenu.
  externalChecksum: text("external_checksum"),
```

Et ajouter l'index partiel en second argument de `pgTable` — `sourceMaterials` n'en a pas aujourd'hui, il faut donc transformer l'appel en forme à deux arguments :

```ts
export const sourceMaterials = pgTable(
  "source_materials",
  {
    /* ...colonnes existantes + les trois ci-dessus... */
  },
  // Un document par chemin et par source. Partiel : la matière collée à la main a sourceId null et
  // n'est pas concernée. Deux repos branchés sur le même sujet peuvent chacun avoir leur README.md.
  (t) => [uniqueIndex().on(t.sourceId, t.externalRef).where(sql`${t.sourceId} is not null`)]
);
```

Ajouter `uniqueIndex` à l'import `drizzle-orm/pg-core` et `sql` à l'import `drizzle-orm`.

- [ ] **Step 6 : Passer la FK des citations en `set null`**

Dans `sourceMaterialCitations` (ligne ~269) :

```ts
    // SET NULL et non CASCADE : sans ça, la suppression d'un sujet connecté (qui cascade jusqu'aux
    // documents miroir) effacerait la traçabilité de scripts déjà publiés. sourceMaterialId null est
    // déjà un état de première classe — citationService.ts l'écrit quand aucun document ne matche,
    // narrativeDirector.ts le filtre, apiClient.ts le type string | null. L'extrait cité reste
    // lisible, il n'est simplement plus rattachable à un document.
    sourceMaterialId: uuid("source_material_id").references(() => sourceMaterials.id, { onDelete: "set null" }),
```

- [ ] **Step 7 : Déclarer les relations**

Avec les autres `relations` en fin de fichier :

```ts
export const materialSourcesRelations = relations(materialSources, ({ one, many }) => ({
  product: one(products, { fields: [materialSources.productId], references: [products.id] }),
  documents: many(sourceMaterials),
}));

export const githubAccountsRelations = relations(githubAccounts, ({ one }) => ({
  user: one(users, { fields: [githubAccounts.userId], references: [users.id] }),
}));
```

Et ajouter `source: one(materialSources, ...)` dans `sourceMaterialsRelations` existant, plus `materialSources: many(materialSources)` dans `productsRelations`.

- [ ] **Step 8 : Ajouter les plafonds dans `src/lib/validation.ts`**

Après `MAX_ASSET_FILE_SIZE_BYTES` :

```ts
// Ingestion d'un repo GitHub (docs/superpowers/specs/2026-08-31-onboarding-dev-github-design.md §6.1).
export const MAX_GITHUB_MD_FILES = 50;
// Un fichier au-delà est IGNORÉ, jamais tronqué : un .md coupé au milieu produirait de la matière
// trompeuse, ce que tout le produit s'interdit.
export const MAX_GITHUB_FILE_BYTES = 100 * 1024;
export const MAX_GITHUB_COMMITS = 100;
```

- [ ] **Step 9 : Générer la migration**

Run: `npm run db:generate`
Expected: un nouveau fichier `drizzle/00XX_*.sql`. **Le relire** : il doit contenir la création des deux tables, les trois enums, `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL`, l'ajout de `onboarding_track`, les trois colonnes sur `source_materials`, l'index unique partiel, et la reprise de la contrainte FK des citations.

- [ ] **Step 10 : Vérifier que le projet compile**

Run: `npm run lint`
Expected: aucune erreur.

- [ ] **Step 11 : Commit**

```bash
git add src/db/schema.ts src/lib/validation.ts drizzle/
git commit -m "feat: modèle de données de l'onboarding dev (identité GitHub, sources de matière)"
```

---

### Task 2 : Client GitHub

**Files:**
- Create: `src/lib/github/client.ts`
- Test: `src/lib/github/client.test.ts`

**Interfaces:**
- Consumes: `MAX_GITHUB_COMMITS` (Task 1).
- Produces:
  - `exchangeCode(code: string): Promise<{ accessToken: string; scope: string }>`
  - `fetchViewer(token: string): Promise<GithubViewer>` où `GithubViewer = { githubUserId: string; login: string; name: string | null; bio: string | null; avatarUrl: string | null; email: string | null }` (`email` non null **seulement** s'il est primaire et vérifié)
  - `listPublicRepos(token: string): Promise<GithubRepo[]>` où `GithubRepo = { externalId: string; fullName: string; name: string; description: string | null; defaultBranch: string; language: string | null; pushedAt: string }`
  - `fetchTree(token, fullName, branch): Promise<{ entries: GithubTreeEntry[]; truncated: boolean }>` où `GithubTreeEntry = { path: string; type: string; sha: string; size?: number }`
  - `fetchBlobText(token, fullName, sha): Promise<string>`
  - `listCommits(token, fullName, branch): Promise<GithubCommit[]>` où `GithubCommit = { sha: string; message: string; authorName: string | null; date: string }`
  - `GithubRateLimitError` (classe, propriété `retryAfterMinutes: number`), `GithubAuthError` (classe)
  - `GITHUB_OAUTH_SCOPE = "read:user user:email"`, `buildAuthorizeUrl(state: string): string`, `isGithubConfigured(): boolean`, `getOAuthCredentials()`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `src/lib/github/client.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeCode,
  fetchViewer,
  listPublicRepos,
  fetchTree,
  listCommits,
  GithubRateLimitError,
} from "./client";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.GITHUB_CLIENT_ID = "test-client-id";
  process.env.GITHUB_CLIENT_SECRET = "test-client-secret";
});

function jsonOk(body: unknown) {
  return { ok: true, status: 200, headers: new Headers(), json: async () => body, text: async () => "" };
}

describe("exchangeCode", () => {
  it("échange le code contre un access token et renvoie le scope accordé", async () => {
    fetchMock.mockResolvedValue(jsonOk({ access_token: "gho_x", scope: "read:user,user:email" }));

    const result = await exchangeCode("auth-code");

    expect(result.accessToken).toBe("gho_x");
    expect(result.scope).toBe("read:user,user:email");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://github.com/login/oauth/access_token");
    expect(options.headers.Accept).toBe("application/json");
  });

  it("lève une erreur explicite quand GitHub renvoie une erreur au lieu d'un token", async () => {
    fetchMock.mockResolvedValue(jsonOk({ error: "bad_verification_code" }));
    await expect(exchangeCode("stale")).rejects.toThrow("bad_verification_code");
  });
});

describe("fetchViewer", () => {
  it("ne renvoie l'email que s'il est primaire ET vérifié", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ id: 42, login: "alix", name: "Alix", bio: "dev", avatar_url: "http://a" }))
      .mockResolvedValueOnce(
        jsonOk([
          { email: "old@example.com", primary: false, verified: true },
          { email: "alix@example.com", primary: true, verified: true },
        ])
      );

    const viewer = await fetchViewer("tok");

    expect(viewer.githubUserId).toBe("42");
    expect(viewer.login).toBe("alix");
    expect(viewer.email).toBe("alix@example.com");
  });

  it("renvoie email null quand l'email primaire n'est pas vérifié", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonOk({ id: 42, login: "alix", name: null, bio: null, avatar_url: null }))
      .mockResolvedValueOnce(jsonOk([{ email: "alix@example.com", primary: true, verified: false }]));

    const viewer = await fetchViewer("tok");

    expect(viewer.email).toBeNull();
  });
});

describe("listPublicRepos", () => {
  it("demande explicitement les repos publics dont l'utilisateur est propriétaire, triés par push", async () => {
    fetchMock.mockResolvedValue(
      jsonOk([
        {
          id: 7,
          full_name: "alix/creaflow",
          name: "creaflow",
          description: "un truc",
          default_branch: "main",
          language: "TypeScript",
          pushed_at: "2026-08-30T10:00:00Z",
        },
      ])
    );

    const repos = await listPublicRepos("tok");

    expect(repos).toEqual([
      {
        externalId: "7",
        fullName: "alix/creaflow",
        name: "creaflow",
        description: "un truc",
        defaultBranch: "main",
        language: "TypeScript",
        pushedAt: "2026-08-30T10:00:00Z",
      },
    ]);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("visibility=public");
    expect(url).toContain("affiliation=owner");
    expect(url).toContain("sort=pushed");
  });
});

describe("fetchTree", () => {
  it("remonte les entrées et le drapeau truncated", async () => {
    fetchMock.mockResolvedValue(
      jsonOk({ truncated: true, tree: [{ path: "README.md", type: "blob", sha: "abc", size: 120 }] })
    );

    const result = await fetchTree("tok", "alix/creaflow", "main");

    expect(result.truncated).toBe(true);
    expect(result.entries[0].path).toBe("README.md");
    expect(fetchMock.mock.calls[0][0]).toContain("recursive=1");
  });
});

describe("listCommits", () => {
  it("aplatit la forme imbriquée de l'API en { sha, message, authorName, date }", async () => {
    fetchMock.mockResolvedValue(
      jsonOk([
        {
          sha: "deadbeef",
          commit: { message: "feat: un truc\n\nParce que.", author: { name: "Alix", date: "2026-08-29T09:00:00Z" } },
        },
      ])
    );

    const commits = await listCommits("tok", "alix/creaflow", "main");

    expect(commits).toEqual([
      { sha: "deadbeef", message: "feat: un truc\n\nParce que.", authorName: "Alix", date: "2026-08-29T09:00:00Z" },
    ]);
  });
});

describe("quota", () => {
  it("traduit un 403 avec x-ratelimit-remaining à 0 en GithubRateLimitError daté", async () => {
    const reset = Math.floor(Date.now() / 1000) + 600; // dans 10 minutes
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "x-ratelimit-remaining": "0", "x-ratelimit-reset": String(reset) }),
      json: async () => ({}),
      text: async () => "rate limited",
    });

    await expect(listPublicRepos("tok")).rejects.toBeInstanceOf(GithubRateLimitError);
  });

  it("laisse passer un 403 ordinaire comme erreur générique", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "x-ratelimit-remaining": "4999" }),
      json: async () => ({}),
      text: async () => "forbidden",
    });

    await expect(listPublicRepos("tok")).rejects.not.toBeInstanceOf(GithubRateLimitError);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/github/client.test.ts`
Expected: FAIL — `Failed to resolve import "./client"`.

- [ ] **Step 3 : Écrire l'implémentation**

Create `src/lib/github/client.ts` :

```ts
import { MAX_GITHUB_COMMITS } from "@/lib/validation";

const OAUTH_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const OAUTH_AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const API = "https://api.github.com";

/** Scope minimal. `public_repo` est délibérément écarté : il accorderait l'ÉCRITURE sur les repos
 *  publics, dont on n'a aucun usage — le contenu public se lit sans scope dédié. `user:email` est en
 *  revanche obligatoire : users.email est NOT NULL UNIQUE et GET /user ne renvoie l'email que s'il
 *  est public sur le profil. */
export const GITHUB_OAUTH_SCOPE = "read:user user:email";

export class GithubRateLimitError extends Error {
  retryAfterMinutes: number;
  constructor(retryAfterMinutes: number) {
    super(`Quota GitHub atteint. Réessaie dans ${retryAfterMinutes} minute(s).`);
    this.name = "GithubRateLimitError";
    this.retryAfterMinutes = retryAfterMinutes;
  }
}

export class GithubAuthError extends Error {
  constructor() {
    super("L'accès GitHub a été révoqué ou a expiré — reconnecte ton compte.");
    this.name = "GithubAuthError";
  }
}

export function getOAuthCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET et GITHUB_OAUTH_REDIRECT_URI doivent être définis dans l'environnement."
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function isGithubConfigured(): boolean {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_OAUTH_REDIRECT_URI);
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = getOAuthCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_OAUTH_SCOPE,
    state,
    allow_signup: "true",
  });
  return `${OAUTH_AUTHORIZE_ENDPOINT}?${params}`;
}

export async function exchangeCode(code: string): Promise<{ accessToken: string; scope: string }> {
  const { clientId, clientSecret, redirectUri } = getOAuthCredentials();
  const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });
  if (!response.ok) {
    throw new Error(`Échange du code GitHub échoué (${response.status}) : ${await response.text()}`);
  }
  const data = (await response.json()) as { access_token?: string; scope?: string; error?: string };
  // GitHub répond 200 même sur un code invalide, avec un champ `error` dans le corps.
  if (data.error || !data.access_token) {
    throw new Error(`Échange du code GitHub échoué : ${data.error ?? "réponse sans access_token"}`);
  }
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

async function apiGet<T>(token: string, path: string, accept = "application/vnd.github+json"): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new GithubAuthError();
    }
    // Un 403 quota-atteint n'est pas une panne de la source : message dédié pour ne pas afficher
    // "erreur GitHub" à quelqu'un qui doit juste attendre.
    if (response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0") {
      const resetEpoch = Number(response.headers.get("x-ratelimit-reset") ?? 0);
      const minutes = Math.max(1, Math.ceil((resetEpoch * 1000 - Date.now()) / 60000));
      throw new GithubRateLimitError(minutes);
    }
    throw new Error(`Appel GitHub ${path} échoué (${response.status}) : ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

export interface GithubViewer {
  githubUserId: string;
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  /** Non null SEULEMENT si GitHub le donne comme primaire et vérifié — condition du rattachement
   *  à un compte existant (spec §4.2). */
  email: string | null;
}

export async function fetchViewer(token: string): Promise<GithubViewer> {
  const user = await apiGet<{
    id: number;
    login: string;
    name: string | null;
    bio: string | null;
    avatar_url: string | null;
  }>(token, "/user");

  const emails = await apiGet<Array<{ email: string; primary: boolean; verified: boolean }>>(token, "/user/emails");
  const primary = emails.find((e) => e.primary && e.verified);

  return {
    githubUserId: String(user.id),
    login: user.login,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    email: primary?.email ?? null,
  };
}

export interface GithubRepo {
  externalId: string;
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  pushedAt: string;
}

export async function listPublicRepos(token: string): Promise<GithubRepo[]> {
  const repos = await apiGet<
    Array<{
      id: number;
      full_name: string;
      name: string;
      description: string | null;
      default_branch: string;
      language: string | null;
      pushed_at: string;
    }>
  >(token, "/user/repos?visibility=public&affiliation=owner&sort=pushed&per_page=100");

  return repos.map((r) => ({
    externalId: String(r.id),
    fullName: r.full_name,
    name: r.name,
    description: r.description,
    defaultBranch: r.default_branch,
    language: r.language,
    pushedAt: r.pushed_at,
  }));
}

export interface GithubTreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

export async function fetchTree(
  token: string,
  fullName: string,
  branch: string
): Promise<{ entries: GithubTreeEntry[]; truncated: boolean }> {
  const data = await apiGet<{ tree: GithubTreeEntry[]; truncated: boolean }>(
    token,
    `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`
  );
  return { entries: data.tree ?? [], truncated: Boolean(data.truncated) };
}

/** `Accept: application/vnd.github.raw` renvoie le contenu directement — évite de décoder le base64
 *  que renvoie la représentation JSON par défaut d'un blob. */
export async function fetchBlobText(token: string, fullName: string, sha: string): Promise<string> {
  const response = await fetch(`${API}/repos/${fullName}/git/blobs/${sha}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!response.ok) {
    throw new Error(`Lecture du blob ${sha} de ${fullName} échouée (${response.status}).`);
  }
  return response.text();
}

export interface GithubCommit {
  sha: string;
  /** Message complet : première ligne = nom du commit, reste = description. */
  message: string;
  authorName: string | null;
  date: string;
}

export async function listCommits(token: string, fullName: string, branch: string): Promise<GithubCommit[]> {
  const commits = await apiGet<
    Array<{ sha: string; commit: { message: string; author: { name: string | null; date: string } | null } }>
  >(token, `/repos/${fullName}/commits?sha=${encodeURIComponent(branch)}&per_page=${MAX_GITHUB_COMMITS}`);

  return commits.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    authorName: c.commit.author?.name ?? null,
    date: c.commit.author?.date ?? "",
  }));
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/github/client.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/github/client.ts src/lib/github/client.test.ts
git commit -m "feat: client GitHub (OAuth, repos publics, arbre, blobs, commits)"
```

---

### Task 3 : Sélection des `.md` et journal de commits

**Files:**
- Create: `src/lib/github/ingest.ts`
- Test: `src/lib/github/ingest.test.ts`

**Interfaces:**
- Consumes: `GithubTreeEntry`, `GithubCommit` (Task 2) ; `MAX_GITHUB_MD_FILES`, `MAX_GITHUB_FILE_BYTES` (Task 1).
- Produces:
  - `COMMITS_EXTERNAL_REF = "__commits__"` (constante exportée)
  - `selectMarkdownFiles(entries: GithubTreeEntry[]): GithubTreeEntry[]`
  - `buildCommitJournal(commits: GithubCommit[]): string`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `src/lib/github/ingest.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildCommitJournal, selectMarkdownFiles } from "./ingest";
import { MAX_GITHUB_MD_FILES } from "@/lib/validation";

const blob = (path: string, size = 100) => ({ path, type: "blob", sha: `sha-${path}`, size });

describe("selectMarkdownFiles", () => {
  it("ne retient que les blobs .md et .markdown", () => {
    const selected = selectMarkdownFiles([
      blob("README.md"),
      blob("notes.markdown"),
      blob("src/index.ts"),
      { path: "docs", type: "tree", sha: "t" },
    ]);
    expect(selected.map((e) => e.path)).toEqual(["README.md", "notes.markdown"]);
  });

  it("place le README racine en premier, puis trie par profondeur puis alphabétiquement", () => {
    const selected = selectMarkdownFiles([
      blob("docs/z.md"),
      blob("docs/a.md"),
      blob("ARCHITECTURE.md"),
      blob("README.md"),
      blob("docs/deep/x.md"),
    ]);
    expect(selected.map((e) => e.path)).toEqual([
      "README.md",
      "ARCHITECTURE.md",
      "docs/a.md",
      "docs/z.md",
      "docs/deep/x.md",
    ]);
  });

  it("exclut le boilerplate identique d'un projet à l'autre mais garde CHANGELOG", () => {
    const selected = selectMarkdownFiles([
      blob("LICENSE.md"),
      blob("CONTRIBUTING.md"),
      blob("CODE_OF_CONDUCT.md"),
      blob("SECURITY.md"),
      blob("CHANGELOG.md"),
    ]);
    expect(selected.map((e) => e.path)).toEqual(["CHANGELOG.md"]);
  });

  it("exclut les répertoires de dépendances et d'artefacts, à la racine comme en profondeur", () => {
    const selected = selectMarkdownFiles([
      blob("node_modules/pkg/README.md"),
      blob("packages/app/node_modules/x/README.md"),
      blob("dist/out.md"),
      blob("build/b.md"),
      blob("vendor/v.md"),
      blob(".github/PULL_REQUEST_TEMPLATE.md"),
      blob("docs/vrai.md"),
    ]);
    expect(selected.map((e) => e.path)).toEqual(["docs/vrai.md"]);
  });

  it("ignore un fichier au-delà du plafond de taille plutôt que de le tronquer", () => {
    const selected = selectMarkdownFiles([blob("gros.md", 200 * 1024), blob("petit.md", 500)]);
    expect(selected.map((e) => e.path)).toEqual(["petit.md"]);
  });

  it("plafonne le nombre de fichiers retenus", () => {
    const many = Array.from({ length: MAX_GITHUB_MD_FILES + 20 }, (_, i) =>
      blob(`docs/${String(i).padStart(3, "0")}.md`)
    );
    expect(selectMarkdownFiles(many)).toHaveLength(MAX_GITHUB_MD_FILES);
  });
});

describe("buildCommitJournal", () => {
  const commit = (message: string, date = "2026-08-29T09:00:00Z", authorName: string | null = "Alix") => ({
    sha: `sha-${message}`,
    message,
    authorName,
    date,
  });

  it("écrit une entrée par commit avec date, auteur, nom et description", () => {
    const journal = buildCommitJournal([commit("feat: contexte d'épisode\n\nLe générateur ne savait pas où il en était.")]);
    expect(journal).toBe("## 2026-08-29 — Alix\nfeat: contexte d'épisode\n\nLe générateur ne savait pas où il en était.");
  });

  it("omet la description quand le message n'a qu'une ligne", () => {
    expect(buildCommitJournal([commit("feat: une vraie fonctionnalité")])).toBe(
      "## 2026-08-29 — Alix\nfeat: une vraie fonctionnalité"
    );
  });

  it("écarte les noms d'un seul mot sans description", () => {
    expect(buildCommitJournal([commit("wip"), commit("fix"), commit("up"), commit("typo")])).toBe("");
  });

  it("garde un nom d'un seul mot s'il porte une description", () => {
    const journal = buildCommitJournal([commit("wip\n\nEn fait il se passe quelque chose ici.")]);
    expect(journal).toContain("En fait il se passe quelque chose ici.");
  });

  it("écarte les commits de merge sans description", () => {
    expect(buildCommitJournal([commit("Merge pull request #1 from alix/feature")])).toBe("");
  });

  it("sépare les entrées par une ligne vide et conserve l'ordre reçu", () => {
    const journal = buildCommitJournal([
      commit("feat: le second", "2026-08-29T09:00:00Z"),
      commit("feat: le premier", "2026-08-28T09:00:00Z"),
    ]);
    expect(journal).toBe("## 2026-08-29 — Alix\nfeat: le second\n\n## 2026-08-28 — Alix\nfeat: le premier");
  });

  it("remplace un auteur manquant par une mention neutre", () => {
    expect(buildCommitJournal([commit("feat: un truc", "2026-08-29T09:00:00Z", null)])).toContain("— auteur inconnu");
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/github/ingest.test.ts`
Expected: FAIL — `Failed to resolve import "./ingest"`.

- [ ] **Step 3 : Écrire l'implémentation**

Create `src/lib/github/ingest.ts` :

```ts
import { MAX_GITHUB_FILE_BYTES, MAX_GITHUB_MD_FILES } from "@/lib/validation";
import type { GithubCommit, GithubTreeEntry } from "./client";

/** Valeur réservée d'`externalRef` pour le journal de commits — un seul par source. */
export const COMMITS_EXTERNAL_REF = "__commits__";

const EXCLUDED_DIRECTORIES = ["node_modules", "dist", "build", "vendor", ".github"];

/** Boilerplate identique d'un projet à l'autre : ces textes ne disent rien sur CE projet et ne
 *  feraient que diluer le corpus. CHANGELOG.md est délibérément absent de cette liste — c'est de la
 *  vraie matière datée. */
const EXCLUDED_BASENAMES = new Set(["license.md", "code_of_conduct.md", "contributing.md", "security.md"]);

function depth(path: string): number {
  return path.split("/").length - 1;
}

function isExcludedDirectory(path: string): boolean {
  const segments = path.split("/");
  // Tous les segments sauf le dernier (le nom de fichier).
  return segments.slice(0, -1).some((segment) => EXCLUDED_DIRECTORIES.includes(segment));
}

export function selectMarkdownFiles(entries: GithubTreeEntry[]): GithubTreeEntry[] {
  const candidates = entries.filter((entry) => {
    if (entry.type !== "blob") return false;
    const lower = entry.path.toLowerCase();
    if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) return false;
    if (isExcludedDirectory(lower)) return false;
    if (EXCLUDED_BASENAMES.has(lower.slice(lower.lastIndexOf("/") + 1))) return false;
    // Ignoré, jamais tronqué : un .md coupé au milieu produirait de la matière trompeuse.
    if (entry.size !== undefined && entry.size > MAX_GITHUB_FILE_BYTES) return false;
    return true;
  });

  candidates.sort((a, b) => {
    const aIsRootReadme = a.path.toLowerCase() === "readme.md";
    const bIsRootReadme = b.path.toLowerCase() === "readme.md";
    if (aIsRootReadme !== bIsRootReadme) return aIsRootReadme ? -1 : 1;
    const depthDiff = depth(a.path) - depth(b.path);
    if (depthDiff !== 0) return depthDiff;
    return a.path.localeCompare(b.path);
  });

  return candidates.slice(0, MAX_GITHUB_MD_FILES);
}

/** Noms de commit qui ne portent aucune information exploitable. Écartés seulement s'ils n'ont pas
 *  de description : "wip" suivi d'un paragraphe explicatif reste de la matière. */
const TRIVIAL_NAMES = new Set(["wip", "fix", "up", "update", "typo", "cleanup", "misc"]);

export function buildCommitJournal(commits: GithubCommit[]): string {
  return commits
    .map((commit) => {
      const [firstLine, ...rest] = commit.message.split("\n");
      return { ...commit, name: firstLine.trim(), description: rest.join("\n").trim() };
    })
    .filter((commit) => {
      if (!commit.name) return false;
      if (commit.description) return true;
      if (commit.name.startsWith("Merge ")) return false;
      return !TRIVIAL_NAMES.has(commit.name.toLowerCase().replace(/[^a-z0-9]/g, ""));
    })
    .map((commit) => {
      const header = `## ${commit.date.slice(0, 10)} — ${commit.authorName ?? "auteur inconnu"}\n${commit.name}`;
      return commit.description ? `${header}\n\n${commit.description}` : header;
    })
    .join("\n\n");
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/github/ingest.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/github/ingest.ts src/lib/github/ingest.test.ts
git commit -m "feat: sélection des .md d'un repo et formatage du journal de commits"
```

---

### Task 4 : Résolution du compte GitHub

**Files:**
- Create: `src/lib/services/githubAuthService.ts`
- Test: `src/lib/services/githubAuthService.test.ts`

**Interfaces:**
- Consumes: `GithubViewer` (Task 2), tables `users`/`githubAccounts` (Task 1).
- Produces:
  - `decideAccountResolution(input: { identityUserId: string | null; hasVerifiedEmail: boolean; userIdWithSameEmail: string | null }): AccountResolution` — **fonction pure, c'est elle qui est testée**
  - `type AccountResolution = { action: "login"; userId: string } | { action: "link"; userId: string } | { action: "create" } | { action: "reject"; reason: string }`
  - `resolveGithubAccount(viewer: GithubViewer, accessToken: string, scope: string): Promise<{ userId: string; isNew: boolean }>` — enveloppe DB, non testée unitairement

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `src/lib/services/githubAuthService.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { decideAccountResolution } from "./githubAuthService";

describe("decideAccountResolution", () => {
  it("connecte sur le compte déjà lié à cette identité GitHub", () => {
    expect(
      decideAccountResolution({ identityUserId: "u1", hasVerifiedEmail: true, userIdWithSameEmail: "u2" })
    ).toEqual({ action: "login", userId: "u1" });
  });

  it("rattache l'identité au compte existant quand l'email est vérifié", () => {
    expect(
      decideAccountResolution({ identityUserId: null, hasVerifiedEmail: true, userIdWithSameEmail: "u2" })
    ).toEqual({ action: "link", userId: "u2" });
  });

  it("crée un compte quand l'email vérifié ne correspond à personne", () => {
    expect(
      decideAccountResolution({ identityUserId: null, hasVerifiedEmail: true, userIdWithSameEmail: null })
    ).toEqual({ action: "create" });
  });

  it("refuse sans email vérifié, même si aucun compte ne porte cette adresse", () => {
    const result = decideAccountResolution({
      identityUserId: null,
      hasVerifiedEmail: false,
      userIdWithSameEmail: null,
    });
    expect(result.action).toBe("reject");
  });

  it("refuse le rattachement sur un email non vérifié — c'est une prise de contrôle de compte", () => {
    const result = decideAccountResolution({
      identityUserId: null,
      hasVerifiedEmail: false,
      userIdWithSameEmail: "u2",
    });
    expect(result.action).toBe("reject");
  });

  it("privilégie l'identité connue même sans email vérifié — le compte est déjà prouvé", () => {
    expect(
      decideAccountResolution({ identityUserId: "u1", hasVerifiedEmail: false, userIdWithSameEmail: null })
    ).toEqual({ action: "login", userId: "u1" });
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/services/githubAuthService.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Create `src/lib/services/githubAuthService.ts` :

```ts
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts, users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import type { GithubViewer } from "@/lib/github/client";

export type AccountResolution =
  | { action: "login"; userId: string }
  | { action: "link"; userId: string }
  | { action: "create" }
  | { action: "reject"; reason: string };

const UNVERIFIED_EMAIL_MESSAGE =
  "GitHub ne fournit pas d'adresse email primaire vérifiée pour ce compte. Vérifie ton email sur GitHub, puis réessaie.";

/**
 * Décision pure de résolution de compte (spec §4.2). Extraite de l'accès base pour être testable
 * sans PostgreSQL — c'est la règle qui compte, pas les requêtes.
 *
 * L'ordre importe : une identité GitHub déjà liée prouve le compte, elle prime sur tout le reste.
 * Le rattachement par email n'est jamais fait sur une adresse non vérifiée — n'importe qui pourrait
 * sinon revendiquer l'adresse d'un compte existant et en prendre le contrôle.
 */
export function decideAccountResolution(input: {
  identityUserId: string | null;
  hasVerifiedEmail: boolean;
  userIdWithSameEmail: string | null;
}): AccountResolution {
  if (input.identityUserId) {
    return { action: "login", userId: input.identityUserId };
  }
  if (!input.hasVerifiedEmail) {
    return { action: "reject", reason: UNVERIFIED_EMAIL_MESSAGE };
  }
  if (input.userIdWithSameEmail) {
    return { action: "link", userId: input.userIdWithSameEmail };
  }
  return { action: "create" };
}

/** Applique la décision ci-dessus et met à jour le token stocké dans tous les cas où l'on connecte. */
export async function resolveGithubAccount(
  viewer: GithubViewer,
  accessToken: string,
  scope: string
): Promise<{ userId: string; isNew: boolean }> {
  const identity = await db.query.githubAccounts.findFirst({
    where: eq(githubAccounts.githubUserId, viewer.githubUserId),
  });
  const email = viewer.email?.toLowerCase() ?? null;
  const sameEmail = email ? await db.query.users.findFirst({ where: eq(users.email, email) }) : null;

  const decision = decideAccountResolution({
    identityUserId: identity?.userId ?? null,
    hasVerifiedEmail: Boolean(email),
    userIdWithSameEmail: sameEmail?.id ?? null,
  });

  const profile = {
    login: viewer.login,
    name: viewer.name,
    bio: viewer.bio,
    avatarUrl: viewer.avatarUrl,
    accessToken,
    scope,
  };

  if (decision.action === "reject") {
    throw new ApiError(409, decision.reason);
  }

  if (decision.action === "login") {
    await db.update(githubAccounts).set(profile).where(eq(githubAccounts.userId, decision.userId));
    return { userId: decision.userId, isNew: false };
  }

  if (decision.action === "link") {
    // onboardingTrack délibérément NON modifié : un compte créateur qui se connecte via GitHub
    // reste en parcours créateur (spec §10).
    await db.insert(githubAccounts).values({ userId: decision.userId, githubUserId: viewer.githubUserId, ...profile });
    return { userId: decision.userId, isNew: false };
  }

  const [user] = await db
    .insert(users)
    .values({ email: email!, passwordHash: null, onboardingTrack: "dev" })
    .returning({ id: users.id });
  await db.insert(githubAccounts).values({ userId: user.id, githubUserId: viewer.githubUserId, ...profile });
  return { userId: user.id, isNew: true };
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/services/githubAuthService.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/services/githubAuthService.ts src/lib/services/githubAuthService.test.ts
git commit -m "feat: résolution du compte à la connexion GitHub"
```

---

### Task 5 : Routes OAuth, garde du login, bouton d'entrée

**Files:**
- Create: `src/app/api/auth/github/start/route.ts`
- Create: `src/app/api/auth/github/callback/route.ts`
- Create: `src/app/api/auth/github/status/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/login/page.tsx`
- Modify: `src/lib/apiClient.ts`

**Interfaces:**
- Consumes: `buildAuthorizeUrl`, `exchangeCode`, `fetchViewer`, `isGithubConfigured` (Task 2) ; `resolveGithubAccount` (Task 4) ; `setSessionCookie` (existant).
- Produces: `GET /api/auth/github/start`, `GET /api/auth/github/callback`, `GET /api/auth/github/status` → `{ configured: boolean }` ; `api.getGithubStatus()` côté client.

- [ ] **Step 1 : Lire la doc des Route Handlers de cette version de Next**

Run: `ls node_modules/next/dist/docs/` puis lire le guide des route handlers et des cookies.
Raison : `AGENTS.md` avertit que cette version diverge des versions connues. Les routes existantes (`src/app/api/auth/[platform]/connect/route.ts`) donnent le pattern local de référence — `cookies()` y est `await`é.

- [ ] **Step 2 : Créer la route d'entrée**

Create `src/app/api/auth/github/start/route.ts` :

```ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { buildAuthorizeUrl } from "@/lib/github/client";
import { handleApiError } from "@/lib/api/errors";

/** Pas de requireUserId() : c'est une porte d'entrée (signup ET login), pas une connexion de compte
 *  posée depuis l'app — contrairement à /api/auth/[platform]/connect. */
export async function GET() {
  try {
    const state = crypto.randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("github_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return NextResponse.redirect(buildAuthorizeUrl(state));
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3 : Créer la route de callback**

Create `src/app/api/auth/github/callback/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchViewer } from "@/lib/github/client";
import { resolveGithubAccount } from "@/lib/services/githubAuthService";
import { setSessionCookie } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";

export async function GET(request: NextRequest) {
  try {
    // Même esprit que signup-ip : la création de compte par OAuth est aussi une création de compte.
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit("github-oauth", ip, 10, 60 * 60);
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code) {
      throw new ApiError(400, "Code OAuth manquant.");
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get("github_oauth_state")?.value;
    cookieStore.delete("github_oauth_state");
    if (!state || state !== expectedState) {
      throw new ApiError(400, "State OAuth invalide, réessaie la connexion.");
    }

    const { accessToken, scope } = await exchangeCode(code);
    const viewer = await fetchViewer(accessToken);
    const { userId, isNew } = await resolveGithubAccount(viewer, accessToken, scope);

    await setSessionCookie(userId);

    return NextResponse.redirect(new URL(isNew ? "/onboarding" : "/calendar", request.url));
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4 : Créer la route de statut de configuration**

Create `src/app/api/auth/github/status/route.ts` :

```ts
import { NextResponse } from "next/server";
import { isGithubConfigured } from "@/lib/github/client";

/** Permet à /login de ne pas afficher un bouton qui mènerait à une erreur quand les variables
 *  d'environnement GitHub sont absentes — même philosophie que Stripe : l'app tourne sans, la
 *  feature est simplement absente. */
export async function GET() {
  return NextResponse.json({ configured: isGithubConfigured() });
}
```

- [ ] **Step 5 : Garder la route de login contre un compte sans mot de passe**

Modify `src/app/api/auth/login/route.ts` — après la récupération de l'utilisateur et **avant** la comparaison du mot de passe, insérer :

```ts
    // passwordHash est nullable depuis l'arrivée de l'identité GitHub. Sans ce garde, on comparerait
    // contre null et on répondrait "mot de passe incorrect" à quelqu'un qui n'a simplement jamais
    // eu de mot de passe — message trompeur qui l'enverrait vers un formulaire d'oubli inutile.
    if (user && !user.passwordHash) {
      throw new ApiError(400, "Ce compte se connecte avec GitHub. Utilise le bouton « Continuer avec GitHub ».");
    }
```

Vérifier que `ApiError` est bien importé dans ce fichier ; l'ajouter à l'import de `@/lib/api/errors` sinon.

- [ ] **Step 6 : Exposer le statut dans le client API**

Modify `src/lib/apiClient.ts` — dans l'objet `api`, juste après `me:` :

```ts
  /** Le bouton GitHub de /login n'est rendu que si les variables d'environnement sont présentes. */
  getGithubStatus: () => apiFetch<{ configured: boolean }>("/api/auth/github/status"),
```

- [ ] **Step 7 : Ajouter le bouton sur `/login`**

Modify `src/app/login/page.tsx` :

1. Ajouter un état `const [githubConfigured, setGithubConfigured] = useState(false);`
2. Ajouter un `useEffect` au montage qui appelle `api.getGithubStatus()` et alimente cet état (avec un `.catch(() => {})` — l'absence de GitHub ne doit jamais casser la page de login).
3. Au-dessus du formulaire, rendre conditionnellement :

```tsx
{githubConfigured && (
  <>
    <a
      href="/api/auth/github/start"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        padding: "12px 16px",
        borderRadius: 12,
        border: `1px solid ${color.border}`,
        background: color.cardBg,
        color: color.textSecondary,
        fontFamily: "inherit",
        fontSize: 15,
        fontWeight: 600,
        textDecoration: "none",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
      Continuer avec GitHub
    </a>
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: color.border }} />
      <span style={{ fontSize: 12, color: color.textFaint }}>ou</span>
      <div style={{ flex: 1, height: 1, background: color.border }} />
    </div>
  </>
)}
```

Vérifier que `color` est importé depuis `@/lib/design/tokens` dans ce fichier.

- [ ] **Step 8 : Vérifier**

Run: `npm run lint && npm run test`
Expected: aucune erreur de lint, tous les tests existants toujours au vert.

- [ ] **Step 9 : Commit**

```bash
git add src/app/api/auth/github src/app/api/auth/login/route.ts src/app/login/page.tsx src/lib/apiClient.ts
git commit -m "feat: connexion et création de compte via GitHub"
```

---

### Task 6 : Diff et synchronisation d'une source

**Files:**
- Create: `src/lib/services/githubSourceService.ts`
- Test: `src/lib/services/githubSourceService.test.ts`

**Interfaces:**
- Consumes: `fetchTree`, `fetchBlobText`, `listCommits`, `GithubRepo` (Task 2) ; `selectMarkdownFiles`, `buildCommitJournal`, `COMMITS_EXTERNAL_REF` (Task 3) ; `markStaleForMaterialIngestion` (existant, `narrativeDirector.ts`).
- Produces:
  - `diffDocuments(existing: ExistingDoc[], incoming: IncomingDoc[]): DocumentDiff` — **fonction pure, testée**
  - `syncSource(userId: string, sourceId: string): Promise<SyncReport>` où `SyncReport = { added: number; updated: number; unchanged: number; truncated: boolean }`
  - `createGithubSources(userId: string, repos: GithubRepo[]): Promise<CreatedSourceResult[]>` où `CreatedSourceResult = { productId: string; sourceId: string; label: string; report: SyncReport | null; error: string | null }` — le token est relu en base depuis `githubAccounts`, il n'est pas passé en argument
  - `listSourcesForProduct(userId: string, productId: string)`, `deleteSource(userId: string, sourceId: string)`
  - (Task 8 ajoutera `buildDevOnboardingContext(userId: string)` dans ce même fichier)

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `src/lib/services/githubSourceService.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { diffDocuments } from "./githubSourceService";

const incoming = (externalRef: string, externalChecksum: string) => ({
  externalRef,
  externalChecksum,
  title: externalRef,
  rawText: `contenu de ${externalRef}`,
});

describe("diffDocuments", () => {
  it("insère un document absent de la base", () => {
    const diff = diffDocuments([], [incoming("README.md", "sha1")]);
    expect(diff.toInsert.map((d) => d.externalRef)).toEqual(["README.md"]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(0);
  });

  it("n'écrit RIEN quand le checksum est identique — c'est ce qui rend le bouton re-sync sûr à cliquer en boucle", () => {
    const diff = diffDocuments(
      [{ id: "m1", externalRef: "README.md", externalChecksum: "sha1" }],
      [incoming("README.md", "sha1")]
    );
    expect(diff.toInsert).toEqual([]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("met à jour un document dont le checksum a changé, en conservant son id", () => {
    const diff = diffDocuments(
      [{ id: "m1", externalRef: "README.md", externalChecksum: "sha1" }],
      [incoming("README.md", "sha2")]
    );
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.toUpdate[0].id).toBe("m1");
    expect(diff.toUpdate[0].doc.externalChecksum).toBe("sha2");
    expect(diff.toInsert).toEqual([]);
  });

  it("met à jour un document existant dont le checksum est null (ingéré avant cette colonne)", () => {
    const diff = diffDocuments(
      [{ id: "m1", externalRef: "README.md", externalChecksum: null }],
      [incoming("README.md", "sha1")]
    );
    expect(diff.toUpdate).toHaveLength(1);
    expect(diff.unchanged).toBe(0);
  });

  it("laisse intact un document dont le chemin a disparu du repo", () => {
    const diff = diffDocuments(
      [
        { id: "m1", externalRef: "README.md", externalChecksum: "sha1" },
        { id: "m2", externalRef: "docs/supprime.md", externalChecksum: "sha9" },
      ],
      [incoming("README.md", "sha1")]
    );
    // Ni insertion, ni mise à jour, ni suppression : le document survit tel quel.
    expect(diff.toInsert).toEqual([]);
    expect(diff.toUpdate).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });

  it("traite plusieurs documents en un seul passage", () => {
    const diff = diffDocuments(
      [
        { id: "m1", externalRef: "a.md", externalChecksum: "sha1" },
        { id: "m2", externalRef: "b.md", externalChecksum: "old" },
      ],
      [incoming("a.md", "sha1"), incoming("b.md", "new"), incoming("c.md", "sha3")]
    );
    expect(diff.unchanged).toBe(1);
    expect(diff.toUpdate.map((u) => u.id)).toEqual(["m2"]);
    expect(diff.toInsert.map((d) => d.externalRef)).toEqual(["c.md"]);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/services/githubSourceService.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3 : Écrire l'implémentation**

Create `src/lib/services/githubSourceService.ts` :

```ts
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts, materialSources, products, sourceMaterials } from "@/db/schema";
import {
  fetchBlobText,
  fetchTree,
  listCommits,
  GithubAuthError,
  type GithubRepo,
} from "@/lib/github/client";
import { buildCommitJournal, COMMITS_EXTERNAL_REF, selectMarkdownFiles } from "@/lib/github/ingest";
import { markStaleForMaterialIngestion } from "@/lib/services/narrativeDirector";
import { ApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";
import { logger } from "@/lib/logger";

export interface ExistingDoc {
  id: string;
  externalRef: string;
  externalChecksum: string | null;
}

export interface IncomingDoc {
  externalRef: string;
  externalChecksum: string;
  title: string;
  rawText: string;
}

export interface DocumentDiff {
  toInsert: IncomingDoc[];
  toUpdate: Array<{ id: string; doc: IncomingDoc }>;
  unchanged: number;
}

/**
 * Décision d'écriture, extraite de l'accès base pour être testable sans PostgreSQL.
 *
 * Un chemin présent en base mais absent du repo n'apparaît dans aucune des trois catégories : il est
 * laissé intact. C'est de la matière passée toujours valable, et ses sourceMaterialCitations
 * pointent dessus.
 */
export function diffDocuments(existing: ExistingDoc[], incoming: IncomingDoc[]): DocumentDiff {
  const byRef = new Map(existing.map((doc) => [doc.externalRef, doc]));
  const diff: DocumentDiff = { toInsert: [], toUpdate: [], unchanged: 0 };

  for (const doc of incoming) {
    const match = byRef.get(doc.externalRef);
    if (!match) {
      diff.toInsert.push(doc);
    } else if (match.externalChecksum === doc.externalChecksum) {
      diff.unchanged += 1;
    } else {
      diff.toUpdate.push({ id: match.id, doc });
    }
  }

  return diff;
}

export interface SyncReport {
  added: number;
  updated: number;
  unchanged: number;
  truncated: boolean;
}

async function getAccessToken(userId: string): Promise<string> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account) {
    throw new ApiError(400, "Aucun compte GitHub connecté.");
  }
  return account.accessToken;
}

/** Construit la liste des documents que le repo devrait produire, sans rien écrire. */
async function collectIncomingDocs(
  token: string,
  fullName: string,
  branch: string
): Promise<{ docs: IncomingDoc[]; truncated: boolean; headSha: string | null }> {
  const { entries, truncated } = await fetchTree(token, fullName, branch);
  const selected = selectMarkdownFiles(entries);

  const docs: IncomingDoc[] = [];
  for (const entry of selected) {
    // Séquentiel plutôt qu'un Promise.all : 50 blobs en parallèle sur le quota GitHub d'un
    // utilisateur qui peut avoir plusieurs repos en cours d'ingestion, pour aucun gain perceptible.
    const rawText = await fetchBlobText(token, fullName, entry.sha);
    if (!rawText.trim()) continue; // un .md vide n'est pas de la matière
    docs.push({ externalRef: entry.path, externalChecksum: entry.sha, title: entry.path, rawText });
  }

  const commits = await listCommits(token, fullName, branch);
  const journal = buildCommitJournal(commits);
  const headSha = commits[0]?.sha ?? null;
  if (journal && headSha) {
    docs.push({
      externalRef: COMMITS_EXTERNAL_REF,
      externalChecksum: headSha,
      title: `Journal de commits — ${fullName}`,
      rawText: journal,
    });
  }

  return { docs, truncated, headSha };
}

export async function syncSource(userId: string, sourceId: string): Promise<SyncReport> {
  const source = await db.query.materialSources.findFirst({
    where: and(eq(materialSources.id, sourceId), eq(materialSources.userId, userId)),
  });
  if (!source) {
    throw new ApiError(404, "Source introuvable.");
  }

  const token = await getAccessToken(userId);
  const branch = (source.config as { defaultBranch?: string }).defaultBranch ?? "main";

  let collected;
  try {
    collected = await collectIncomingDocs(token, source.label, branch);
  } catch (error) {
    // Repo passé en privé, supprimé, ou token révoqué : la source devient inutilisable, mais les
    // documents déjà ingérés restent (spec §10).
    const isAuth = error instanceof GithubAuthError;
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await db
      .update(materialSources)
      .set({ status: isAuth ? "needs_reconnect" : "error", lastError: message })
      .where(eq(materialSources.id, sourceId));
    throw error;
  }

  // Repo vide, ou sans aucun .md ni commit exploitable : rien à ingérer. Le sujet est conservé —
  // l'utilisateur l'a choisi délibérément — mais la source dit clairement qu'elle ne donne rien,
  // plutôt que d'afficher une synchronisation réussie sur un corpus resté vide (spec §10).
  if (collected.docs.length === 0) {
    await db
      .update(materialSources)
      .set({
        status: "error",
        lastError: "Ce dépôt ne contient ni fichier .md ni commit exploitable.",
        lastSyncedAt: new Date(),
      })
      .where(eq(materialSources.id, sourceId));
    return { added: 0, updated: 0, unchanged: 0, truncated: collected.truncated };
  }

  const existing = await db.query.sourceMaterials.findMany({
    where: and(eq(sourceMaterials.sourceId, sourceId), isNotNull(sourceMaterials.externalRef)),
    columns: { id: true, externalRef: true, externalChecksum: true },
  });

  const diff = diffDocuments(
    existing.map((doc) => ({ id: doc.id, externalRef: doc.externalRef!, externalChecksum: doc.externalChecksum })),
    collected.docs
  );

  if (diff.toInsert.length > 0) {
    await db.insert(sourceMaterials).values(
      diff.toInsert.map((doc) => ({
        userId,
        productId: source.productId,
        sourceId,
        kind: "connector" as const,
        title: doc.title,
        rawText: doc.rawText,
        externalRef: doc.externalRef,
        externalChecksum: doc.externalChecksum,
      }))
    );
  }

  for (const { id, doc } of diff.toUpdate) {
    await db
      .update(sourceMaterials)
      // summary remis à null : pour une source connectée, c'est le repo qui fait foi, pas une
      // édition locale — rupture volontaire avec la règle "l'édition manuelle devient la source de
      // vérité" d'updateMaterialSummary. Le backfill paresseux le regénérera.
      .set({ rawText: doc.rawText, externalChecksum: doc.externalChecksum, title: doc.title, summary: null })
      .where(eq(sourceMaterials.id, id));
  }

  await db
    .update(materialSources)
    .set({
      lastSyncedAt: new Date(),
      syncCursor: collected.headSha,
      status: "ok",
      // Une ingestion partielle (arbre tronqué sur un repo volumineux) est signalée sans passer la
      // source en "error" : ce n'est pas un échec.
      lastError: collected.truncated ? "Repo volumineux : l'arbre GitHub a été tronqué, ingestion partielle." : null,
    })
    .where(eq(materialSources.id, sourceId));

  if (diff.toInsert.length > 0 || diff.toUpdate.length > 0) {
    // Sans ça le rédacteur en chef ne replanifierait pas après un sync — même geste que
    // POST /api/materials sur un dépôt manuel.
    await markStaleForMaterialIngestion(userId, source.productId);
  }

  return {
    added: diff.toInsert.length,
    updated: diff.toUpdate.length,
    unchanged: diff.unchanged,
    truncated: collected.truncated,
  };
}

export interface CreatedSourceResult {
  productId: string;
  sourceId: string;
  label: string;
  report: SyncReport | null;
  error: string | null;
}

/** Crée un sujet et une source par repo, puis ingère. Un repo qui échoue n'empêche pas les autres :
 *  le sujet reste, la source porte l'erreur, et l'utilisateur peut resynchroniser plus tard. */
export async function createGithubSources(
  userId: string,
  repos: GithubRepo[]
): Promise<CreatedSourceResult[]> {
  const existing = await db.query.products.findMany({ where: eq(products.userId, userId), columns: { id: true } });
  if (existing.length + repos.length > MAX_PRODUCTS) {
    throw new ApiError(400, `Maximum ${MAX_PRODUCTS} sujets (${existing.length} déjà enregistrés).`);
  }

  const results: CreatedSourceResult[] = [];

  for (const repo of repos) {
    const [product] = await db
      .insert(products)
      .values({ userId, name: repo.name, description: repo.description ?? null })
      .returning({ id: products.id });

    const [source] = await db
      .insert(materialSources)
      .values({
        userId,
        productId: product.id,
        type: "github_repo",
        externalId: repo.externalId,
        label: repo.fullName,
        config: { defaultBranch: repo.defaultBranch },
      })
      .returning({ id: materialSources.id });

    try {
      const report = await syncSource(userId, source.id);
      results.push({ productId: product.id, sourceId: source.id, label: repo.fullName, report, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      logger.error("Ingestion GitHub échouée (sujet et source conservés)", error, { fullName: repo.fullName });
      results.push({ productId: product.id, sourceId: source.id, label: repo.fullName, report: null, error: message });
    }
  }

  return results;
}

export async function listSourcesForProduct(userId: string, productId: string) {
  return db.query.materialSources.findMany({
    where: and(eq(materialSources.userId, userId), eq(materialSources.productId, productId)),
  });
}

/** Supprime la source ET ses documents miroir (cascade sur sourceMaterials.sourceId, spec §3.3). */
export async function deleteSource(userId: string, sourceId: string) {
  const [deleted] = await db
    .delete(materialSources)
    .where(and(eq(materialSources.id, sourceId), eq(materialSources.userId, userId)))
    .returning({ id: materialSources.id });
  if (!deleted) {
    throw new ApiError(404, "Source introuvable.");
  }
  return deleted;
}
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/services/githubSourceService.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5 : Vérifier que rien d'autre n'a cassé**

Run: `npm run test && npm run lint`
Expected: tout au vert.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/services/githubSourceService.ts src/lib/services/githubSourceService.test.ts
git commit -m "feat: ingestion et resynchronisation idempotente d'un repo GitHub"
```

---

### Task 7 : Routes repos et sources

**Files:**
- Create: `src/app/api/github/repos/route.ts`
- Create: `src/app/api/material-sources/route.ts`
- Create: `src/app/api/material-sources/[id]/route.ts`
- Create: `src/app/api/material-sources/[id]/sync/route.ts`
- Modify: `src/lib/apiClient.ts`

**Interfaces:**
- Consumes: `listPublicRepos` (Task 2) ; `createGithubSources`, `syncSource`, `listSourcesForProduct`, `deleteSource` (Task 6).
- Produces: `api.getGithubRepos()`, `api.connectGithubRepos(repos)`, `api.getMaterialSources(productId)`, `api.syncMaterialSource(id)`, `api.deleteMaterialSource(id)` ; interface client `MaterialSource`.

- [ ] **Step 1 : Créer `GET`/`POST /api/github/repos`**

Create `src/app/api/github/repos/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { listPublicRepos } from "@/lib/github/client";
import { createGithubSources } from "@/lib/services/githubSourceService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";

const connectSchema = z.object({
  repos: z
    .array(
      z.object({
        externalId: z.string().min(1),
        fullName: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable(),
        defaultBranch: z.string().min(1),
        language: z.string().nullable(),
        pushedAt: z.string(),
      })
    )
    .min(1)
    .max(MAX_PRODUCTS),
});

async function requireGithubToken(userId: string): Promise<string> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account) {
    throw new ApiError(400, "Aucun compte GitHub connecté.");
  }
  return account.accessToken;
}

export async function GET() {
  try {
    const userId = await requireUserId();
    const token = await requireGithubToken(userId);
    return NextResponse.json({ repos: await listPublicRepos(token) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await requireGithubToken(userId);
    const { repos } = connectSchema.parse(await request.json());
    // Synchrone : l'ingestion est du fetch et de l'écriture, aucun appel LLM (le résumé est laissé
    // au backfill paresseux). L'UI affiche la progression repo par repo à partir du tableau renvoyé.
    const results = await createGithubSources(userId, repos);
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 2 : Créer `GET /api/material-sources`**

Create `src/app/api/material-sources/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { listSourcesForProduct } from "@/lib/services/githubSourceService";
import { handleApiError } from "@/lib/api/errors";

const listSchema = z.object({ productId: z.uuid() });

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    return NextResponse.json({ sources: await listSourcesForProduct(userId, productId) });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 3 : Créer `DELETE /api/material-sources/[id]`**

Create `src/app/api/material-sources/[id]/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { deleteSource } from "@/lib/services/githubSourceService";
import { handleApiError } from "@/lib/api/errors";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteSource(userId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
```

- [ ] **Step 4 : Créer `POST /api/material-sources/[id]/sync`**

Create `src/app/api/material-sources/[id]/sync/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { syncSource } from "@/lib/services/githubSourceService";
import { GithubRateLimitError } from "@/lib/github/client";
import { ApiError, handleApiError } from "@/lib/api/errors";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    return NextResponse.json({ report: await syncSource(userId, id) });
  } catch (error) {
    // Le quota atteint n'est pas une panne : 429 et message daté, pas un 500 "Erreur serveur".
    if (error instanceof GithubRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    return handleApiError(error);
  }
}
```

- [ ] **Step 5 : Étendre le client API**

Modify `src/lib/apiClient.ts` — ajouter l'interface près des autres, puis les méthodes dans `api` :

```ts
export interface GithubRepoOption {
  externalId: string;
  fullName: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  pushedAt: string;
}

export interface MaterialSource {
  id: string;
  productId: string;
  type: "github_repo";
  externalId: string;
  label: string;
  syncCursor: string | null;
  lastSyncedAt: string | null;
  status: "ok" | "error" | "needs_reconnect";
  lastError: string | null;
  createdAt: string;
}

export interface SyncReport {
  added: number;
  updated: number;
  unchanged: number;
  truncated: boolean;
}

export interface ConnectRepoResult {
  productId: string;
  sourceId: string;
  label: string;
  report: SyncReport | null;
  error: string | null;
}
```

```ts
  getGithubRepos: () => apiFetch<{ repos: GithubRepoOption[] }>("/api/github/repos"),
  connectGithubRepos: (repos: GithubRepoOption[]) =>
    post<{ results: ConnectRepoResult[] }>("/api/github/repos", { repos }),

  getMaterialSources: (productId: string) =>
    apiFetch<{ sources: MaterialSource[] }>(`/api/material-sources?productId=${productId}`),
  syncMaterialSource: (id: string) => post<{ report: SyncReport }>(`/api/material-sources/${id}/sync`),
  deleteMaterialSource: (id: string) => del<{ ok: true }>(`/api/material-sources/${id}`),
```

- [ ] **Step 6 : Vérifier**

Run: `npm run lint && npm run test`
Expected: tout au vert.

- [ ] **Step 7 : Commit**

```bash
git add src/app/api/github src/app/api/material-sources src/lib/apiClient.ts
git commit -m "feat: endpoints de sélection de repos et de synchronisation des sources"
```

---

### Task 8 : Prompt d'onboarding dev

**Files:**
- Modify: `src/lib/llm/onboardingChat.ts`
- Modify: `src/app/api/onboarding/chat/route.ts`
- Test: `src/lib/llm/onboardingChat.test.ts` (créer)

**Interfaces:**
- Consumes: `updateOnboardingProfileTool`, `onboardingChatResultSchema`, `runOnboardingChatTurn` (existants).
- Produces:
  - `devOnboardingProfileTool: LlmToolDefinition` (dérivé du tool existant, **sans** `equipment`)
  - `DEV_SYSTEM_PROMPT: string`
  - `buildDevContext(input: DevOnboardingContext): string`
  - `runDevOnboardingChatTurn(context: { history: OnboardingMessage[]; dev: DevOnboardingContext }): Promise<OnboardingChatResult>`
  - `DevOnboardingContext = { login: string; name: string | null; bio: string | null; subjects: Array<{ name: string; description: string | null; language: string | null; readmeExcerpt: string | null }> }`

- [ ] **Step 1 : Écrire les tests qui échouent**

Create `src/lib/llm/onboardingChat.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { buildDevContext, devOnboardingProfileTool, DEV_SYSTEM_PROMPT } from "./onboardingChat";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

describe("devOnboardingProfileTool", () => {
  it("ne propose pas equipment — hors sujet pour du contenu de dev, majoritairement textuel", () => {
    const fields = devOnboardingProfileTool.input_schema.properties.extractedFields as {
      properties: Record<string, unknown>;
    };
    expect(fields.properties).not.toHaveProperty("equipment");
  });

  it("conserve les champs que finalizeOnboarding exige", () => {
    const fields = devOnboardingProfileTool.input_schema.properties.extractedFields as {
      properties: Record<string, unknown>;
    };
    for (const key of ["brandName", "activityType", "weeklyTimeAvailable", "suggestedPlatforms", "targetAudience"]) {
      expect(fields.properties).toHaveProperty(key);
    }
  });

  it("garde le même contrat de sortie que le tool généraliste", () => {
    expect(devOnboardingProfileTool.input_schema.required).toEqual(["assistantReply", "extractedFields", "complete"]);
  });
});

describe("DEV_SYSTEM_PROMPT", () => {
  it("interdit explicitement de demander le matériel de production", () => {
    expect(DEV_SYSTEM_PROMPT.toLowerCase()).toContain("matériel");
  });

  it("borne le nombre de questions", () => {
    expect(DEV_SYSTEM_PROMPT).toMatch(/deux|trois/i);
  });

  it("ne laisse suggérer que des plateformes connues", () => {
    for (const platform of KNOWN_PLATFORMS) {
      expect(DEV_SYSTEM_PROMPT).toContain(platform.key);
    }
  });
});

describe("buildDevContext", () => {
  it("résume le profil GitHub et les sujets retenus", () => {
    const context = buildDevContext({
      login: "alix",
      name: "Alix",
      bio: "je fabrique des trucs",
      subjects: [
        { name: "creaflow", description: "rédacteur en chef IA", language: "TypeScript", readmeExcerpt: "Creaflow est…" },
      ],
    });

    expect(context).toContain("alix");
    expect(context).toContain("creaflow");
    expect(context).toContain("TypeScript");
    expect(context).toContain("Creaflow est…");
  });

  it("reste lisible quand tout l'optionnel est absent", () => {
    const context = buildDevContext({
      login: "alix",
      name: null,
      bio: null,
      subjects: [{ name: "truc", description: null, language: null, readmeExcerpt: null }],
    });

    expect(context).toContain("alix");
    expect(context).toContain("truc");
    expect(context).not.toContain("null");
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/llm/onboardingChat.test.ts`
Expected: FAIL — `buildDevContext` / `devOnboardingProfileTool` / `DEV_SYSTEM_PROMPT` non exportés.

- [ ] **Step 3 : Ajouter le variant dev dans `src/lib/llm/onboardingChat.ts`**

À la suite de l'existant (ne rien supprimer — le parcours créateur reste inchangé) :

```ts
/** Même contrat de sortie que le tool généraliste, moins `equipment` : hors sujet pour du contenu de
 *  dev, majoritairement textuel. Dérivé plutôt que recopié pour qu'une évolution du schéma partagé
 *  (nouveau champ de profil) ne se perde pas dans un seul des deux parcours. */
export const devOnboardingProfileTool: LlmToolDefinition = (() => {
  const base = updateOnboardingProfileTool.input_schema.properties.extractedFields as {
    type: string;
    description: string;
    properties: Record<string, unknown>;
  };
  const { equipment: _equipment, ...properties } = base.properties;
  return {
    ...updateOnboardingProfileTool,
    input_schema: {
      ...updateOnboardingProfileTool.input_schema,
      properties: {
        ...updateOnboardingProfileTool.input_schema.properties,
        extractedFields: { ...base, properties },
      },
    },
  };
})();

export const DEV_SYSTEM_PROMPT = `Tu es l'assistant d'onboarding de CreaFlow. La personne en face de toi est développeuse : elle vient de connecter son compte GitHub et de choisir les projets dont elle veut parler. Tu connais déjà son identité et ses projets, ils te sont donnés en contexte.

Règles :
- Tu as déjà de quoi déduire brandName et activityType depuis le profil GitHub et les projets. Ne les demande PAS à froid : propose-les en récapitulatif court, et laisse corriger.
- Tu n'as droit qu'à DEUX ou TROIS questions au total, une à la fois : le ton de communication souhaité, l'audience visée, et le temps disponible par semaine. Rien d'autre.
- Ne demande JAMAIS le matériel de production (caméra, micro, lumière) : le contenu d'un développeur est essentiellement écrit, la question serait absurde.
- Ne suppose pas qu'il s'agit de vidéo. Suggère en priorité les réseaux où l'écrit et le technique fonctionnent, mais uniquement parmi : ${KNOWN_PLATFORM_KEYS.join(", ")}.
- L'audience visée est utile mais optionnelle : si la personne ne sait pas répondre ou préfère passer, n'insiste pas.
- Marque complete=true dès que brandName, activityType, weeklyTimeAvailable et au moins une plateforme sont connus, et termine par un récapitulatif court.`;

export interface DevOnboardingContext {
  login: string;
  name: string | null;
  bio: string | null;
  subjects: Array<{
    name: string;
    description: string | null;
    language: string | null;
    readmeExcerpt: string | null;
  }>;
}

/** Bloc de contexte préfixé à la transcription — c'est ce qui permet au modèle de ne pas reposer les
 *  questions dont GitHub a déjà la réponse. */
export function buildDevContext(input: DevOnboardingContext): string {
  const lines: string[] = ["Profil GitHub :", `- identifiant : ${input.login}`];
  if (input.name) lines.push(`- nom : ${input.name}`);
  if (input.bio) lines.push(`- bio : ${input.bio}`);

  lines.push("", "Projets retenus comme sujets :");
  for (const subject of input.subjects) {
    const details = [subject.language, subject.description].filter(Boolean).join(" · ");
    lines.push(`- ${subject.name}${details ? ` (${details})` : ""}`);
    if (subject.readmeExcerpt) {
      lines.push(`  extrait du README : ${subject.readmeExcerpt}`);
    }
  }

  return lines.join("\n");
}

export async function runDevOnboardingChatTurn(context: {
  history: OnboardingMessage[];
  dev: DevOnboardingContext;
}): Promise<OnboardingChatResult> {
  const transcript = context.history
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`)
    .join("\n");

  const args = await callStructured({
    system: DEV_SYSTEM_PROMPT,
    userMessage: `${buildDevContext(context.dev)}\n\n---\n\n${transcript}`,
    tool: devOnboardingProfileTool,
    maxTokens: 1024,
  });

  return onboardingChatResultSchema.parse(args);
}
```

- [ ] **Step 4 : Aiguiller la route de chat**

Modify `src/app/api/onboarding/chat/route.ts` — dans le `POST`, remplacer l'appel unique par un aiguillage. Ajouter les imports (`db`, `users`, `products`, `sourceMaterials`, `githubAccounts`, `materialSources`, `runDevOnboardingChatTurn`, `eq`/`and`), puis :

```ts
    const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { onboardingTrack: true } });

    const result =
      user?.onboardingTrack === "dev"
        ? await runDevOnboardingChatTurn({
            history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES),
            dev: await buildDevOnboardingContext(userId),
          })
        : await runOnboardingChatTurn({ history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES) });
```

Et ajouter, dans `src/lib/services/githubSourceService.ts`, la fonction qui assemble ce contexte :

```ts
/** Contexte injecté au chat d'onboarding dev : profil GitHub + sujets retenus, avec le début de leur
 *  README déjà ingéré. Le README est retrouvé par son externalRef, pas par une relecture GitHub. */
export async function buildDevOnboardingContext(userId: string) {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  const sources = await db.query.materialSources.findMany({ where: eq(materialSources.userId, userId) });
  const productRows = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const subjects = [];
  for (const product of productRows) {
    const source = sources.find((s) => s.productId === product.id);
    const readme = source
      ? await db.query.sourceMaterials.findFirst({
          where: and(eq(sourceMaterials.sourceId, source.id), eq(sourceMaterials.externalRef, "README.md")),
          columns: { rawText: true },
        })
      : null;
    subjects.push({
      name: product.name,
      description: product.description,
      language: null as string | null,
      readmeExcerpt: readme ? readme.rawText.slice(0, 600) : null,
    });
  }

  return {
    login: account?.login ?? "",
    name: account?.name ?? null,
    bio: account?.bio ?? null,
    subjects,
  };
}
```

- [ ] **Step 5 : Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/llm/onboardingChat.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6 : Vérifier la non-régression du parcours créateur**

Run: `npm run test && npm run lint`
Expected: tout au vert, en particulier les tests existants qui touchent l'onboarding.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/llm/onboardingChat.ts src/lib/llm/onboardingChat.test.ts src/app/api/onboarding/chat/route.ts src/lib/services/githubSourceService.ts
git commit -m "feat: chat d'onboarding dédié au parcours dev"
```

---

### Task 9 : UI de l'onboarding dev

**Files:**
- Create: `src/components/RepoPicker.tsx`
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/api/profile/route.ts` (exposer `onboardingTrack`)
- Modify: `src/lib/apiClient.ts`

**Interfaces:**
- Consumes: `api.getGithubRepos()`, `api.connectGithubRepos()` (Task 7).
- Produces: composant `RepoPicker({ onConnected }: { onConnected: () => void })` ; `GET /api/profile` renvoie `{ profile, onboardingTrack }`.

- [ ] **Step 1 : Exposer le track**

Modify `src/app/api/profile/route.ts` — dans le `GET`, lire `users.onboardingTrack` et l'ajouter à la réponse : `NextResponse.json({ profile, onboardingTrack })`.

Modify `src/lib/apiClient.ts` — changer la signature :

```ts
  getProfile: () =>
    apiFetch<{ profile: CreatorProfile | null; onboardingTrack: "creator" | "dev" }>("/api/profile"),
```

- [ ] **Step 2 : Créer `RepoPicker`**

Create `src/components/RepoPicker.tsx` — composant client, suivant le style de `ProductCatalogue.tsx` (styles inline, tokens de `@/lib/design/tokens`) :

```tsx
"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ConnectRepoResult, type GithubRepoOption } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { MAX_PRODUCTS } from "@/lib/validation";

export default function RepoPicker({ onConnected }: { onConnected: () => void }) {
  const [repos, setRepos] = useState<GithubRepoOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [results, setResults] = useState<ConnectRepoResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGithubRepos()
      .then(({ repos }) => setRepos(repos))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Impossible de lire tes dépôts GitHub."))
      .finally(() => setLoading(false));
  }, []);

  function toggle(externalId: string) {
    setSelected((prev) =>
      prev.includes(externalId)
        ? prev.filter((id) => id !== externalId)
        : prev.length >= MAX_PRODUCTS
          ? prev
          : [...prev, externalId]
    );
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const { results } = await api.connectGithubRepos(repos.filter((r) => selected.includes(r.externalId)));
      setResults(results);
      onConnected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La récupération de la matière a échoué.");
    } finally {
      setConnecting(false);
    }
  }

  if (loading) return <p style={{ color: color.textMuted, fontSize: 14 }}>Lecture de tes dépôts…</p>;

  // Jamais un cul-de-sac : sans repo public, on renvoie vers la saisie manuelle de sujets.
  if (repos.length === 0) {
    return (
      <div>
        <p style={{ color: color.textMuted, fontSize: 15, margin: "0 0 16px" }}>
          Aucun dépôt public trouvé sur ton compte GitHub. Tu peux décrire tes sujets à la main — la matière
          se colle ensuite depuis l&apos;écran du sujet.
        </p>
        <Button onClick={onConnected}>Décrire mes sujets à la main</Button>
      </div>
    );
  }

  if (results) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {results.map((result) => (
          <div key={result.sourceId} style={{ fontSize: 14, color: result.error ? color.danger : color.textSecondary }}>
            <strong>{result.label}</strong>{" "}
            {result.error
              ? `— échec : ${result.error}`
              : `— ${result.report!.added} document${result.report!.added > 1 ? "s" : ""} récupéré${
                  result.report!.added > 1 ? "s" : ""
                }`}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {repos.map((repo) => {
          const isSelected = selected.includes(repo.externalId);
          return (
            <button
              key={repo.externalId}
              onClick={() => toggle(repo.externalId)}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${isSelected ? accent : color.border}`,
                background: isSelected ? accentAlpha(0.08) : color.cardBg,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{repo.name}</div>
              {repo.description && (
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>{repo.description}</div>
              )}
              <div style={{ fontSize: 12, color: color.textFaint, marginTop: 6 }}>
                {[repo.language, `mis à jour le ${repo.pushedAt.slice(0, 10)}`].filter(Boolean).join(" · ")}
              </div>
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <Button onClick={connect} disabled={selected.length === 0 || connecting}>
        {connecting
          ? "Récupération de la matière…"
          : `Utiliser ${selected.length} projet${selected.length > 1 ? "s" : ""} comme sujets`}
      </Button>
      <p style={{ fontSize: 12, color: color.textFaint, marginTop: 10 }}>
        {selected.length} sur {MAX_PRODUCTS} maximum. On récupère les fichiers .md et l&apos;historique des commits.
      </p>
    </div>
  );
}
```

- [ ] **Step 3 : Aiguiller la page d'onboarding**

Modify `src/app/onboarding/page.tsx` :

1. Ajouter `const [track, setTrack] = useState<"creator" | "dev">("creator");` et l'alimenter depuis `api.getProfile()` dans le `useEffect` existant.
2. Remplacer le tableau de libellés de `StepTab` par une valeur dépendant du track :
   `const labels = track === "dev" ? ["1 · Projets", "2 · Discussion", "3 · Réseaux"] : ["1 · Discussion", "2 · Sujets", "3 · Réseaux"];`
   (passer `track` en prop de `StepTab`).
3. Pour `track === "dev"`, l'étape 1 rend `<RepoPicker onConnected={() => setStep(2)} />` et l'étape 2 rend `<OnboardingChat onComplete={() => setStep(3)} />`. L'étape 3 est inchangée dans les deux cas.
4. Le garde `productCount < MIN_PRODUCTS` de `goNext` ne s'applique qu'au parcours créateur — en dev, les sujets sont créés par `RepoPicker`.

- [ ] **Step 4 : Vérifier à l'écran**

Run: `npm run dev`
Vérifier : `/login` affiche le bouton GitHub quand les variables sont posées ; le parcours créateur (signup email) est **strictement identique** à avant ; un compte dev voit « 1 · Projets ».

- [ ] **Step 5 : Vérifier**

Run: `npm run lint && npm run test`
Expected: tout au vert.

- [ ] **Step 6 : Commit**

```bash
git add src/components/RepoPicker.tsx src/app/onboarding/page.tsx src/app/api/profile/route.ts src/lib/apiClient.ts
git commit -m "feat: onboarding dev — choix des dépôts comme sujets"
```

---

### Task 10 : Encart « Sources connectées » et resynchronisation

**Files:**
- Create: `src/components/ConnectedSources.tsx`
- Modify: l'écran matière d'un sujet (repérer le consommateur de `api.getMaterials` — probablement sous `src/app/(app)/direction/` ou un composant de matière ; le localiser avec `grep -rn "getMaterials" src`)

**Interfaces:**
- Consumes: `api.getMaterialSources`, `api.syncMaterialSource`, `api.deleteMaterialSource` (Task 7).
- Produces: composant `ConnectedSources({ productId }: { productId: string })`.

- [ ] **Step 1 : Localiser l'écran matière**

Run: `grep -rn "getMaterials\|listMaterialsForSubject" src --include=*.tsx`
Noter le composant qui affiche la liste de matière d'un sujet — c'est là que l'encart s'insère, au-dessus de la liste.

- [ ] **Step 2 : Créer `ConnectedSources`**

Create `src/components/ConnectedSources.tsx` :

```tsx
"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type MaterialSource, type SyncReport } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

export default function ConnectedSources({ productId }: { productId: string }) {
  const [sources, setSources] = useState<MaterialSource[]>([]);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, SyncReport>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMaterialSources(productId)
      .then(({ sources }) => setSources(sources))
      .catch(() => {});
  }, [productId]);

  async function sync(id: string) {
    setSyncingId(id);
    setError(null);
    try {
      const { report } = await api.syncMaterialSource(id);
      setReports((prev) => ({ ...prev, [id]: report }));
      const { sources } = await api.getMaterialSources(productId);
      setSources(sources);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La synchronisation a échoué.");
    } finally {
      setSyncingId(null);
    }
  }

  async function unlink(source: MaterialSource) {
    // Confirmation explicite : débrancher supprime les documents miroir.
    if (!window.confirm(`Débrancher ${source.label} supprimera les documents récupérés depuis ce dépôt. Continuer ?`)) {
      return;
    }
    await api.deleteMaterialSource(source.id);
    setSources((prev) => prev.filter((s) => s.id !== source.id));
  }

  if (sources.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: color.textSecondary, margin: "0 0 10px" }}>
        Sources connectées
      </h3>
      <div style={{ display: "grid", gap: 10 }}>
        {sources.map((source) => {
          const report = reports[source.id];
          return (
            <div
              key={source.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                border: `1px solid ${color.border}`,
                background: color.cardBg,
              }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{source.label}</div>
                <div style={{ fontSize: 12, color: color.textFaint, marginTop: 3 }}>
                  {source.lastSyncedAt
                    ? `Synchronisé le ${source.lastSyncedAt.slice(0, 10)}`
                    : "Jamais synchronisé"}
                  {source.status === "needs_reconnect" && " · accès perdu, reconnecte GitHub"}
                </div>
                {/* Dire ce qui a bougé : sans ça l'utilisateur reclique par doute. */}
                {report && (
                  <div style={{ fontSize: 12, color: color.textMuted, marginTop: 4 }}>
                    {report.added} ajouté{report.added > 1 ? "s" : ""}, {report.updated} mis à jour,{" "}
                    {report.unchanged} inchangé{report.unchanged > 1 ? "s" : ""}
                  </div>
                )}
                {source.lastError && (
                  <div style={{ fontSize: 12, color: color.danger, marginTop: 4 }}>{source.lastError}</div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <Button variant="secondary" onClick={() => sync(source.id)} disabled={syncingId === source.id}>
                  {syncingId === source.id ? "…" : "Resynchroniser"}
                </Button>
                <Button variant="ghost" onClick={() => unlink(source)}>
                  Débrancher
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p style={{ color: color.danger, fontSize: 13, marginTop: 10 }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3 : Insérer l'encart**

Dans le composant repéré au Step 1, importer `ConnectedSources` et le rendre au-dessus de la liste de matière, en lui passant le `productId` courant. Il se rend nul quand le sujet n'a aucune source, donc aucune condition à ajouter côté appelant.

- [ ] **Step 4 : Vérifier**

Run: `npm run lint && npm run test`
Expected: tout au vert.

- [ ] **Step 5 : Commit**

```bash
git add src/components/ConnectedSources.tsx src/app
git commit -m "feat: encart des sources connectées avec resynchronisation manuelle"
```

---

### Task 11 : Configuration et documentation

**Files:**
- Modify: `.env.example`
- Modify: `docs/TECH.md`
- Modify: `docs/PRODUCT.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: tout ce qui précède.
- Produces: rien de consommé par du code.

- [ ] **Step 1 : Ajouter les variables d'environnement**

Modify `.env.example` :

```
# Onboarding développeur (OAuth App GitHub, scope read:user user:email).
# Sans ces variables, le bouton "Continuer avec GitHub" n'est pas affiché et le parcours
# email/mot de passe reste entièrement fonctionnel.
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/github/callback
```

- [ ] **Step 2 : Documenter dans `docs/TECH.md`**

Ajouter une section couvrant : les deux tables (`github_accounts`, `material_sources`) et les trois colonnes de `source_materials` ; les endpoints du tableau §8 de la spec ; la règle de résolution de compte (§4.2) ; l'idempotence du re-sync (§6.3) ; et les deux déviations de convention assumées — `sourceMaterials.sourceId` en CASCADE, `sourceMaterialCitations.sourceMaterialId` passé en SET NULL — avec leur justification.

- [ ] **Step 3 : Mettre à jour `docs/PRODUCT.md`**

Dans le tableau §4 (« Corpus & Éditeur »), déplacer « dépôt git » de la colonne *Prochaine étape* vers *État actuel*, en gardant « dossier de notes synchronisé, Obsidian » en prochaine étape. Mettre à jour §6 (Prochaines étapes) en conséquence : le point 2 ne couvre plus que les sources non-git. Mentionner en §2.3 le second parcours d'onboarding.

- [ ] **Step 4 : Mettre à jour `CLAUDE.md`**

Dans « Configuration », ajouter une phrase sur les trois variables GitHub, en précisant qu'elles sont optionnelles en dev. Dans « Documentation projet », ajouter la ligne pointant vers la spec.

- [ ] **Step 5 : Vérification finale complète**

Run: `npm run lint && npm run test && npm run build`
Expected: les trois au vert.

- [ ] **Step 6 : Commit**

```bash
git add .env.example docs/TECH.md docs/PRODUCT.md CLAUDE.md
git commit -m "docs: documenter l'onboarding dev et les sources de matière connectées"
```

---

## Notes d'exécution

**Ordre des dépendances :** 1 → 2 → 3 → 4 → 5, puis 6 → 7 → 8 → 9 → 10, puis 11. Les tâches 3 et 4 ne dépendent que de la 1 et de la 2 et peuvent être menées en parallèle. La 10 peut être décalée sans bloquer le reste.

**Vérification manuelle requise avant de déclarer la feature finie** — aucun test automatisé ne couvre le trajet OAuth réel :
1. Créer une OAuth App sur GitHub (`Settings › Developer settings › OAuth Apps`), callback `http://localhost:3000/api/auth/github/callback`.
2. `npm run db:migrate`, puis `npm run dev`.
3. Se connecter avec GitHub depuis `/login` → un compte est créé, l'onboarding s'ouvre sur « 1 · Projets ».
4. Choisir un repo réel → vérifier en base que `source_materials` a une ligne et que `sourceMaterials` contient un document par `.md` plus le journal.
5. Recliquer « Resynchroniser » sans rien changer dans le repo → le rapport doit annoncer **0 ajouté, 0 mis à jour** ; c'est la preuve de l'idempotence en conditions réelles.
6. Se déconnecter, se reconnecter avec GitHub → on atterrit sur `/calendar`, pas sur l'onboarding.
7. Créer un compte email/mot de passe → le parcours créateur doit être identique à ce qu'il était avant cette branche.
