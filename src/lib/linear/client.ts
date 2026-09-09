import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import { getOAuthRedirectUri } from "@/lib/oauth/types";
import { MAX_LINEAR_ISSUES, MAX_LINEAR_UPDATES } from "@/lib/validation";

/**
 * Client Linear. API exclusivement GraphQL — il n'existe pas de REST chez eux.
 *
 * Particularité qui dimensionne le reste : le token d'accès ne vaut que **24 heures**
 * (docs/SPEC_CONNECTEURS_ET_SUJETS.md §7.4). Sans rafraîchissement, une source branchée cesse de
 * se synchroniser le lendemain.
 */

const GRAPHQL_ENDPOINT = "https://api.linear.app/graphql";
const OAUTH_AUTHORIZE_ENDPOINT = "https://linear.app/oauth/authorize";
const OAUTH_TOKEN_ENDPOINT = "https://api.linear.app/oauth/token";

/** Lecture seule. `write` n'a aucun usage ici et donnerait le droit de modifier les tickets. */
export const LINEAR_OAUTH_SCOPE = "read";

export class LinearAuthError extends Error {
  constructor() {
    super("L'accès Linear a été révoqué ou a expiré — reconnecte ton compte.");
    this.name = "LinearAuthError";
  }
}

export class LinearRateLimitError extends ConnectorRateLimitError {
  constructor(retryAfterMinutes: number) {
    super(`Quota Linear atteint. Réessaie dans ${retryAfterMinutes} minute(s).`, retryAfterMinutes);
    this.name = "LinearRateLimitError";
  }
}

function credentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LINEAR_CLIENT_ID et LINEAR_CLIENT_SECRET doivent être définis dans l'environnement.");
  }
  return { clientId, clientSecret, redirectUri: getOAuthRedirectUri("linear") };
}

export function isLinearConfigured(): boolean {
  return Boolean(process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET);
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: LINEAR_OAUTH_SCOPE,
    state,
  });
  return `${OAUTH_AUTHORIZE_ENDPOINT}?${params}`;
}

export interface LinearTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string;
}

async function postToken(body: Record<string, string>): Promise<LinearTokens> {
  const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body),
  });

  if (!response.ok) {
    throw new Error(`Échange du code Linear échoué (${response.status}) : ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string | string[];
  };

  if (!data.access_token) {
    throw new Error("Échange du code Linear échoué : réponse sans access_token.");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    // ~86400 s. Toujours renseigné en pratique ; si Linear l'omettait, mieux vaut null qu'une date
    // inventée — getValidProviderAccessToken laisserait alors l'appel échouer explicitement.
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    scope: Array.isArray(data.scope) ? data.scope.join(" ") : (data.scope ?? LINEAR_OAUTH_SCOPE),
  };
}

export function exchangeCode(code: string): Promise<LinearTokens> {
  const { clientId, clientSecret, redirectUri } = credentials();
  return postToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

export function refreshAccessToken(refreshToken: string): Promise<LinearTokens> {
  const { clientId, clientSecret } = credentials();
  return postToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
}

/** Une réponse GraphQL en erreur porte le statut 200 : sans ce garde, on lirait `data` à undefined
 *  et l'erreur ne remonterait qu'en aval, méconnaissable. */
async function gql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new LinearAuthError();
  }
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after") ?? 60);
    throw new LinearRateLimitError(Math.max(1, Math.ceil(seconds / 60)));
  }
  if (!response.ok) {
    throw new Error(`Appel Linear échoué (${response.status}) : ${await response.text()}`);
  }

  const body = (await response.json()) as { data?: T; errors?: Array<{ message?: string; extensions?: { code?: string } }> };
  if (body.errors?.length) {
    // Un token révoqué remonte parfois en erreur GraphQL plutôt qu'en 401 — le distinguer ici
    // évite de passer la source en "error" alors qu'il faut juste reconnecter le compte.
    if (body.errors.some((e) => e.extensions?.code === "AUTHENTICATION_ERROR")) {
      throw new LinearAuthError();
    }
    throw new Error(`Appel Linear échoué : ${body.errors.map((e) => e.message ?? "erreur inconnue").join(" ; ")}`);
  }
  if (!body.data) {
    throw new Error("Appel Linear échoué : réponse sans données.");
  }
  return body.data;
}

export interface LinearViewer {
  id: string;
  name: string | null;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export async function fetchViewer(token: string): Promise<LinearViewer> {
  const data = await gql<{ viewer: { id: string; name?: string; displayName?: string; email?: string; avatarUrl?: string } }>(
    token,
    `query { viewer { id name displayName email avatarUrl } }`
  );
  const v = data.viewer;
  return {
    id: v.id,
    name: v.name ?? null,
    displayName: v.displayName ?? null,
    email: v.email ?? null,
    avatarUrl: v.avatarUrl ?? null,
  };
}

export interface LinearProject {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
  /** Affiché dans le sélecteur : sans ça, deux projets homonymes de deux équipes se confondent. */
  teamNames: string[];
}

export async function listProjects(token: string): Promise<LinearProject[]> {
  const data = await gql<{
    projects: { nodes: Array<{ id: string; name: string; description?: string | null; updatedAt: string; teams?: { nodes: Array<{ name: string }> } }> };
  }>(token, `query { projects(first: 100) { nodes { id name description updatedAt teams(first: 5) { nodes { name } } } } }`);

  return data.projects.nodes.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    updatedAt: p.updatedAt,
    teamNames: p.teams?.nodes.map((t) => t.name) ?? [],
  }));
}

export interface LinearProjectUpdate {
  id: string;
  body: string;
  createdAt: string;
  authorName: string | null;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface LinearProjectContent {
  project: LinearProject | null;
  updates: LinearProjectUpdate[];
  issues: LinearIssue[];
}

/**
 * Tout ce qu'un projet donne comme matière, en une requête. Les issues sont filtrées sur les
 * terminées : une issue en cours ne raconte rien, une issue livrée est une anecdote datée.
 */
export async function fetchProjectContent(token: string, projectId: string): Promise<LinearProjectContent> {
  const data = await gql<{
    project: {
      id: string;
      name: string;
      description?: string | null;
      updatedAt: string;
      teams?: { nodes: Array<{ name: string }> };
      projectUpdates?: { nodes: Array<{ id: string; body?: string | null; createdAt: string; user?: { name?: string | null } | null }> };
      issues?: { nodes: Array<{ id: string; identifier: string; title: string; description?: string | null; completedAt?: string | null; updatedAt: string }> };
    } | null;
  }>(
    token,
    `query Project($id: String!, $updates: Int!, $issues: Int!) {
      project(id: $id) {
        id name description updatedAt
        teams(first: 5) { nodes { name } }
        projectUpdates(first: $updates) { nodes { id body createdAt user { name } } }
        issues(first: $issues, filter: { completedAt: { null: false } }) {
          nodes { id identifier title description completedAt updatedAt }
        }
      }
    }`,
    { id: projectId, updates: MAX_LINEAR_UPDATES, issues: MAX_LINEAR_ISSUES }
  );

  const p = data.project;
  if (!p) return { project: null, updates: [], issues: [] };

  return {
    project: {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      updatedAt: p.updatedAt,
      teamNames: p.teams?.nodes.map((t) => t.name) ?? [],
    },
    updates: (p.projectUpdates?.nodes ?? []).map((u) => ({
      id: u.id,
      body: u.body ?? "",
      createdAt: u.createdAt,
      authorName: u.user?.name ?? null,
    })),
    issues: (p.issues?.nodes ?? []).map((i) => ({
      id: i.id,
      identifier: i.identifier,
      title: i.title,
      description: i.description ?? null,
      completedAt: i.completedAt ?? null,
      updatedAt: i.updatedAt,
    })),
  };
}
