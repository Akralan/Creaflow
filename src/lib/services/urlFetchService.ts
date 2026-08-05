export interface FetchedSource {
  url: string;
  text: string;
}

export interface UrlFetchFailure {
  url: string;
  reason: string;
}

export interface FetchSourcesResult {
  sources: FetchedSource[];
  failures: UrlFetchFailure[];
}

export const MAX_SOURCE_URLS = 3;
const FETCH_TIMEOUT_MS = 8000;
const MAX_CHARS_PER_SOURCE = 6000;

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
];

function isHostnameBlocked(hostname: string): boolean {
  return BLOCKED_HOSTNAME_PATTERNS.some((pattern) => pattern.test(hostname));
}

/** Extraction minimaliste : pas de dépendance HTML parser, juste un strip de balises
 *  suffisant pour donner du texte lisible au LLM (pas un rendu fidèle de la page). */
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CHARS_PER_SOURCE);
}

async function fetchOne(rawUrl: string): Promise<FetchedSource> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("URL invalide.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Seuls les liens http/https sont acceptés.");
  }
  if (isHostnameBlocked(parsed.hostname)) {
    throw new Error("Cette adresse n'est pas autorisée.");
  }

  const res = await fetch(parsed.toString(), { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`Erreur HTTP ${res.status}.`);
  }
  const html = await res.text();
  const text = extractText(html);
  if (!text) {
    throw new Error("Aucun contenu texte exploitable trouvé sur cette page.");
  }
  return { url: rawUrl, text };
}

export async function fetchSources(urls: string[]): Promise<FetchSourcesResult> {
  const capped = urls.slice(0, MAX_SOURCE_URLS);
  const results = await Promise.allSettled(capped.map(fetchOne));

  const sources: FetchedSource[] = [];
  const failures: UrlFetchFailure[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      sources.push(result.value);
    } else {
      failures.push({ url: capped[i], reason: result.reason instanceof Error ? result.reason.message : "Erreur inconnue." });
    }
  });

  return { sources, failures };
}
