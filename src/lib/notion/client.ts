import { ConnectorRateLimitError } from "@/lib/connectors/errors";
import { getOAuthRedirectUri } from "@/lib/oauth/types";

/**
 * Client HTTP Notion. Même découpage que `src/lib/github/client.ts` : OAuth et lecture d'API ici,
 * traduction vers les contrats du cœur dans `src/lib/oauth/notion.ts` et
 * `src/lib/connectors/notion.ts`.
 */

const API = "https://api.notion.com/v1";

/** Version d'API épinglée (vérifiée le 2026-09-09, docs/SPEC_CONNECTEURS_ET_SUJETS.md §10). Notion
 *  exige cet en-tête sur CHAQUE requête et fige la forme des réponses dessus — la changer impose de
 *  relire le mapping, en particulier le type `data_source`, qui s'appelait `database` avant. */
const NOTION_VERSION = "2026-03-11";

/** `owner=user` : on veut l'identité de la personne qui autorise, pas seulement le workspace —
 *  c'est ce qui fait remonter `owner.user.person.email`, sans quoi l'inscription est impossible
 *  (users.email est NOT NULL UNIQUE). */
const OAUTH_AUTHORIZE_ENDPOINT = "https://api.notion.com/v1/oauth/authorize";

export class NotionAuthError extends Error {
  constructor() {
    super("L'accès Notion a été révoqué ou a expiré — reconnecte ton compte.");
    this.name = "NotionAuthError";
  }
}

export class NotionRateLimitError extends ConnectorRateLimitError {
  constructor(retryAfterMinutes: number) {
    super(`Quota Notion atteint. Réessaie dans ${retryAfterMinutes} minute(s).`, retryAfterMinutes);
    this.name = "NotionRateLimitError";
  }
}

function credentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("NOTION_CLIENT_ID et NOTION_CLIENT_SECRET doivent être définis dans l'environnement.");
  }
  return { clientId, clientSecret, redirectUri: getOAuthRedirectUri("notion") };
}

export function isNotionConfigured(): boolean {
  return Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET);
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    owner: "user",
    redirect_uri: redirectUri,
    state,
  });
  return `${OAUTH_AUTHORIZE_ENDPOINT}?${params}`;
}

export interface NotionTokenResponse {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  workspaceId: string | null;
  workspaceName: string | null;
  botId: string | null;
  ownerUserId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  /** Null si Notion ne donne pas d'email pour ce propriétaire (intégration autorisée par un bot,
   *  ou owner de type workspace) — l'inscription échoue alors explicitement plutôt que d'inventer. */
  ownerEmail: string | null;
}

/** L'échange se fait en Basic auth `client_id:client_secret`, pas en paramètres de corps — c'est la
 *  particularité de Notion par rapport à GitHub et Linear. */
async function postToken(body: Record<string, string>): Promise<NotionTokenResponse> {
  const { clientId, clientSecret } = credentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Échange du code Notion échoué (${response.status}) : ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    workspace_id?: string;
    workspace_name?: string | null;
    bot_id?: string;
    owner?: { type?: string; user?: { id?: string; name?: string | null; avatar_url?: string | null; person?: { email?: string } } };
  };

  if (!data.access_token) {
    throw new Error("Échange du code Notion échoué : réponse sans access_token.");
  }

  const user = data.owner?.user;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
    workspaceId: data.workspace_id ?? null,
    workspaceName: data.workspace_name ?? null,
    botId: data.bot_id ?? null,
    ownerUserId: user?.id ?? null,
    ownerName: user?.name ?? null,
    ownerAvatarUrl: user?.avatar_url ?? null,
    ownerEmail: user?.person?.email ?? null,
  };
}

export function exchangeCode(code: string): Promise<NotionTokenResponse> {
  const { redirectUri } = credentials();
  return postToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshAccessToken(refreshToken: string): Promise<NotionTokenResponse> {
  return postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
}

async function apiCall<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new NotionAuthError();
    }
    // Un quota atteint n'est pas une panne de la source : message dédié plutôt qu'« erreur Notion »
    // à quelqu'un qui doit seulement attendre. Notion renvoie Retry-After en secondes.
    if (response.status === 429) {
      const seconds = Number(response.headers.get("retry-after") ?? 60);
      throw new NotionRateLimitError(Math.max(1, Math.ceil(seconds / 60)));
    }
    throw new Error(`Appel Notion ${path} échoué (${response.status}) : ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

/** Objet remonté par la recherche. `objectType` distingue une page d'une base — depuis la version
 *  2026-03-11, une base est un `data_source` et non plus un `database`. */
export interface NotionSearchResult {
  id: string;
  objectType: "page" | "data_source";
  title: string;
  lastEditedTime: string;
  /** true quand le parent est le workspace : c'est ce qui définit une racine. Une sous-page n'est
   *  pas un sujet — elle fait partie de la matière de sa racine. */
  isRoot: boolean;
}

interface RawSearchResult {
  id: string;
  object: string;
  last_edited_time?: string;
  parent?: { type?: string };
  properties?: Record<string, { type?: string; title?: Array<{ plain_text?: string }> }>;
  title?: Array<{ plain_text?: string }>;
}

/** Titre d'une page (porté par la propriété de type `title`) ou d'une base (porté par `title`). */
export function extractTitle(raw: RawSearchResult): string {
  const fromProperties = Object.values(raw.properties ?? {}).find((p) => p.type === "title");
  const parts = fromProperties?.title ?? raw.title ?? [];
  const text = parts.map((t) => t.plain_text ?? "").join("").trim();
  return text || "Sans titre";
}

/**
 * Pages et bases partagées avec l'intégration. Notion ne montre QUE ce que l'utilisateur a
 * explicitement partagé : une liste vide n'est pas une erreur, c'est un partage à faire, et l'écran
 * doit le dire (docs/SPEC_CONNECTEURS_ET_SUJETS.md §4).
 */
export async function searchSharedObjects(token: string): Promise<NotionSearchResult[]> {
  const results: NotionSearchResult[] = [];

  for (const value of ["page", "data_source"] as const) {
    let cursor: string | undefined;
    do {
      const page = await apiCall<{ results: RawSearchResult[]; has_more: boolean; next_cursor: string | null }>(
        token,
        "/search",
        {
          method: "POST",
          body: JSON.stringify({
            filter: { property: "object", value },
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {}),
          }),
        }
      );

      for (const raw of page.results) {
        results.push({
          id: raw.id,
          objectType: value,
          title: extractTitle(raw),
          lastEditedTime: raw.last_edited_time ?? "",
          isRoot: raw.parent?.type === "workspace",
        });
      }

      cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  return results;
}

export interface NotionBlock {
  id: string;
  type: string;
  hasChildren: boolean;
  /** Le bloc brut, pour que le rendu en texte reste une fonction pure et testable à part. */
  raw: Record<string, unknown>;
}

export async function listBlockChildren(
  token: string,
  blockId: string,
  cursor?: string
): Promise<{ blocks: NotionBlock[]; nextCursor: string | null }> {
  const params = new URLSearchParams({ page_size: "100", ...(cursor ? { start_cursor: cursor } : {}) });
  const page = await apiCall<{
    results: Array<{ id: string; type: string; has_children?: boolean } & Record<string, unknown>>;
    has_more: boolean;
    next_cursor: string | null;
  }>(token, `/blocks/${blockId}/children?${params}`);

  return {
    blocks: page.results.map((raw) => ({
      id: raw.id,
      type: raw.type,
      hasChildren: Boolean(raw.has_children),
      raw,
    })),
    nextCursor: page.has_more ? page.next_cursor : null,
  };
}
