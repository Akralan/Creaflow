import { MAX_GITHUB_COMMITS } from "@/lib/validation";

const OAUTH_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const OAUTH_AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const API = "https://api.github.com";

/** Scope minimal. `public_repo` est délibérément écarté : il accorderait l'ÉCRITURE sur les dépôts
 *  publics, dont on n'a aucun usage — le contenu public se lit sans scope dédié. `user:email` est en
 *  revanche obligatoire : users.email est NOT NULL UNIQUE et GET /user ne renvoie l'email que s'il
 *  est public sur le profil. `read:org` (lecture seule) l'est aussi : sans lui, GitHub refuse de
 *  révéler les appartenances aux organisations et `affiliation=organization_member` renvoie []
 *  (vérifié empiriquement — /user/orgs répond 403 « You need at least read:org scope »). */
export const GITHUB_OAUTH_SCOPE = "read:user user:email read:org";

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
  return Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_OAUTH_REDIRECT_URI
  );
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
  // GitHub répond 200 même sur un code invalide, avec un champ `error` dans le corps plutôt qu'un
  // statut d'erreur — sans ce garde on stockerait `undefined` comme token.
  if (data.error || !data.access_token) {
    throw new Error(`Échange du code GitHub échoué : ${data.error ?? "réponse sans access_token"}`);
  }
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

async function apiGet<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new GithubAuthError();
    }
    // Un 403 quota-atteint n'est pas une panne de la source : message dédié pour ne pas afficher
    // "erreur GitHub" à quelqu'un qui doit seulement attendre.
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
  /** Non null SEULEMENT si GitHub le donne comme primaire ET vérifié — condition du rattachement à
   *  un compte existant (spec §4.2). */
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

/** `affiliation=owner,collaborator,organization_member` : les dépôts publics sur lesquels
 *  l'utilisateur travaille — les siens, ceux où il est collaborateur direct, ceux des organisations
 *  dont il est membre — comptent tous comme sujets de contenu. Le volet organisation exige le scope
 *  `read:org` (cf. GITHUB_OAUTH_SCOPE). Limite connue : une organisation qui a activé les « OAuth
 *  App access restrictions » masque ses dépôts à l'app tant qu'elle ne l'a pas approuvée — réglage
 *  côté GitHub, invisible d'ici. */
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
  >(token, "/user/repos?visibility=public&affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100");

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
 *  de la représentation JSON par défaut d'un blob. */
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
