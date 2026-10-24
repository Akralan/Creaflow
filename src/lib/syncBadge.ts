/**
 * Le badge de synchronisation de Business context (docs/SPEC_SYNCHRO_QUOTIDIENNE.md) : ce que les
 * sources du projet disent de leur dernière lecture, en un mot. Pur.
 */

export interface SyncBadge {
  label: string;
  tone: "ok" | "warn" | "none";
}

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Rien sans source. « Needs reconnect » gagne sur tout : une source dont le jeton est tombé ne se
 *  lit plus, quelle que soit la date des autres. */
export function syncBadge(sources: ReadonlyArray<{ lastSyncedAt: string | Date | null; status: string }>, now: Date = new Date()): SyncBadge | null {
  if (sources.length === 0) return null;
  if (sources.some((s) => s.status === "needs_reconnect")) return { label: "Needs reconnect", tone: "warn" };
  const times = sources.map((s) => (s.lastSyncedAt ? new Date(s.lastSyncedAt).getTime() : null)).filter((t): t is number => t !== null);
  if (times.length === 0) return { label: "Not synced yet", tone: "none" };
  // La plus ancienne des sources : c'est elle qui dit de quand date la matière la moins fraîche.
  const oldest = Math.min(...times);
  const age = Math.max(0, now.getTime() - oldest);
  if (age < HOUR) return { label: "Synced just now", tone: "ok" };
  if (age < DAY) return { label: `Synced ${Math.floor(age / HOUR)} h ago`, tone: "ok" };
  const days = Math.floor(age / DAY);
  if (days < 7) return { label: `Synced ${days} ${days > 1 ? "days" : "day"} ago`, tone: days >= 2 ? "warn" : "ok" };
  const weeks = Math.floor(days / 7);
  return { label: `Synced ${weeks} ${weeks > 1 ? "weeks" : "week"} ago`, tone: "warn" };
}
