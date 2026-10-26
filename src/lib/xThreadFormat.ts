/**
 * Le thread X d'un post (docs/TODO.md, décidé le 2026-10-26) : la version X est le post LinkedIn
 * adapté, en autant de tweets que son contenu en demande. Stocké dans les colonnes de toujours :
 * `title` / `hookText` = le premier tweet, `caption` = les suivants, séparés par une ligne `---`.
 * Un thread d'un seul tweet garde ce tweet des deux côtés (`caption` ne peut pas être vide).
 *
 * Sans dépendance : l'écran l'importe pour afficher les tweets un par un.
 */
export const TWEET_MAX = 280;
export const THREAD_SEPARATOR = "\n\n---\n\n";

/** Les tweets d'une version X : le premier tweet, puis ceux de la caption. */
export function threadTweets(title: string | null | undefined, caption: string): string[] {
  const rest = splitThread(caption);
  const first = (title ?? "").trim();
  if (!first) return rest;
  // Un seul tweet : la caption répète le titre.
  if (rest.length === 1 && rest[0] === first) return [first];
  return [first, ...rest];
}

export function splitThread(caption: string): string[] {
  return caption
    .split(/\n\s*---\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function joinThread(tweets: string[]): { title: string; caption: string } {
  const clean = tweets.map((t) => t.trim()).filter(Boolean);
  const [first = "", ...rest] = clean;
  return { title: first, caption: rest.length > 0 ? rest.join(THREAD_SEPARATOR) : first };
}

/** Coupe un tweet trop long aux fins de phrase, puis aux espaces : jamais au milieu d'un mot. */
export function fitTweets(tweets: string[], max: number = TWEET_MAX): string[] {
  const out: string[] = [];
  for (const tweet of tweets.map((t) => t.trim()).filter(Boolean)) {
    if (tweet.length <= max) {
      out.push(tweet);
      continue;
    }
    let current = "";
    for (const piece of tweet.split(/(?<=[.!?…])\s+/)) {
      const words = piece.length > max ? piece.split(/\s+/) : [piece];
      for (const w of words) {
        const next = current ? `${current} ${w}` : w;
        if (next.length <= max) current = next;
        else {
          if (current) out.push(current);
          current = w.slice(0, max);
        }
      }
    }
    if (current) out.push(current);
  }
  return out;
}
