import type { ScriptStatus } from "@/lib/design/tokens";

/**
 * The posts of a week as the screen shows them (docs/SPEC_APP_DESIGN_TELLOVO.md E2, E13, E14): a post is the
 * pair of slots of a series on a day, one per network. Pure, so it is testable without a screen.
 */

export const NETWORKS = ["linkedin", "x"] as const;
export type Network = (typeof NETWORKS)[number];

const DAY_MS = 24 * 3600 * 1000;

/** The slot fields the grouping needs (a subset of `WeekEntry`). */
export interface SlotLike {
  id: string;
  platform: string;
  scheduledDate: string;
  seriesId?: string | null;
  series?: { id: string } | null;
  status: string;
  script: { id: string; status: ScriptStatus } | null;
}

export interface PostGroup<T extends SlotLike = SlotLike> {
  /** `seriesId|YYYY-MM-DD` — stable across reloads, used to remember which post is open. */
  key: string;
  date: string;
  versions: Partial<Record<Network, T>>;
}

/** `YYYY-MM-DD` of an ISO instant, read in UTC (slots are stored at UTC midnight). */
export function dayKey(iso: string | Date): string {
  return (typeof iso === "string" ? new Date(iso) : iso).toISOString().slice(0, 10);
}

/** Monday (UTC midnight) of the week holding `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isNetwork(platform: string): platform is Network {
  return (NETWORKS as readonly string[]).includes(platform);
}

/** Groups slots into posts, oldest day first, LinkedIn version before X. Slots of other networks are ignored. */
export function groupPosts<T extends SlotLike>(entries: T[]): PostGroup<T>[] {
  const groups = new Map<string, PostGroup<T>>();
  for (const entry of entries) {
    if (!isNetwork(entry.platform)) continue;
    const date = dayKey(entry.scheduledDate);
    const key = `${entry.seriesId ?? entry.series?.id ?? "free"}|${date}`;
    const group = groups.get(key) ?? { key, date, versions: {} };
    group.versions[entry.platform] = entry;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));
}

/** What a post card says: still to write, being written, or its state of readiness. */
export type PostState = "empty" | "writing" | "draft" | "ready" | "posted";

export function postState(group: PostGroup): PostState {
  const versions = Object.values(group.versions);
  const written = versions.filter((v) => v.script);
  if (written.length === 0) return versions.some((v) => v.status === "generating") ? "writing" : "empty";
  // The post is as far along as its least advanced version: Ready needs both texts ready.
  const states = written.map((v) => scriptReadiness(v.script!.status));
  if (versions.some((v) => !v.script && v.status === "generating")) return "writing";
  if (states.every((s) => s === "posted")) return "posted";
  if (states.every((s) => s === "ready" || s === "posted")) return "ready";
  return "draft";
}

/** The three statuses of the screen (E14) over the four of the model: `shot` (the retired video) reads as Ready. */
export function scriptReadiness(status: ScriptStatus): "draft" | "ready" | "posted" {
  if (status === "published") return "posted";
  if (status === "planned" || status === "shot") return "ready";
  return "draft";
}

/** Counter of the menu: posts of the week that are Ready (or Posted) out of those planned. */
export function weekCounter(groups: PostGroup[]): { ready: number; total: number } {
  const total = groups.length;
  const ready = groups.filter((g) => ["ready", "posted"].includes(postState(g))).length;
  return { ready, total };
}

const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** « Tuesday, Oct 20 » */
export function longDay(dateKey: string): string {
  return DAY.format(new Date(`${dateKey}T00:00:00Z`));
}

/** « Tue 20 » */
export function shortDay(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return `${WEEKDAY_SHORT.format(d)} ${d.getUTCDate()}`;
}

/** « Oct 19 – 25 », or « Oct 26 – Nov 1 » across months. */
export function weekRange(monday: Date): string {
  const sunday = addDays(monday, 6);
  const start = MONTH_DAY.format(monday);
  return monday.getUTCMonth() === sunday.getUTCMonth() ? `${start} – ${sunday.getUTCDate()}` : `${start} – ${MONTH_DAY.format(sunday)}`;
}
