import { z } from "zod";
import { MAX_DURATION_MS, MIN_DURATION_MS } from "./visualFormat";

/**
 * Timeline of an animated mockup (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2 "The animation
 * model"): one entry per layer that appears or disappears. An absent layer is visible from start
 * to end. An object separate from the HTML — never animation CSS in the slides.
 */
export const ENTER_EFFECTS = ["fade", "slide-up", "slide-left", "zoom-in", "typewriter"] as const;
export const EXIT_EFFECTS = ["fade", "slide-down", "slide-right", "none"] as const;
export type EnterEffect = (typeof ENTER_EFFECTS)[number];
export type ExitEffect = (typeof EXIT_EFFECTS)[number];

export const MIN_ENTER_MS = 150;
export const MAX_ENTER_MS = 1500;
export const DEFAULT_ENTER_MS = 500;
export const EXIT_MS = 400;

export const timelineEntrySchema = z.object({
  layerId: z.string().trim().min(1).max(32),
  enter: z.enum(ENTER_EFFECTS),
  startMs: z.number().int().min(0),
  enterMs: z.number().int().min(MIN_ENTER_MS).max(MAX_ENTER_MS),
  exit: z.enum(EXIT_EFFECTS).nullable(),
  exitAtMs: z.number().int().min(0).nullable(),
});
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

export const timelineSchema = z.array(timelineEntrySchema).max(24);
export type Timeline = z.infer<typeof timelineSchema>;

export const durationMsSchema = z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS);

export class TimelineValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Timeline rejected: ${issues.join(" · ")}`);
    this.name = "TimelineValidationError";
    this.issues = issues;
  }
}

/**
 * Validates and normalizes: existing layers, a single pass per layer, times within the duration,
 * exit after entrance, sorted by start. Throws TimelineValidationError with the list of problems
 * (returned to the model for a second attempt, or as a 422 to a manual write).
 */
export function normalizeTimeline(raw: unknown, layerIds: string[], durationMs: number): Timeline {
  const parsed = timelineSchema.safeParse(raw);
  if (!parsed.success) {
    throw new TimelineValidationError(parsed.error.issues.map((i) => `${i.path.join(".") || "timeline"} : ${i.message}`));
  }
  const issues: string[] = [];
  const known = new Set(layerIds);
  const seen = new Set<string>();
  const out: Timeline = [];
  for (const entry of parsed.data) {
    if (!known.has(entry.layerId)) {
      issues.push(`layer "${entry.layerId}" unknown`);
      continue;
    }
    if (seen.has(entry.layerId)) {
      issues.push(`layer "${entry.layerId}" present twice`);
      continue;
    }
    seen.add(entry.layerId);
    if (entry.startMs >= durationMs) {
      issues.push(`layer "${entry.layerId}": start ${entry.startMs} ms beyond the duration ${durationMs} ms`);
      continue;
    }
    const startMs = entry.startMs;
    const enterMs = Math.min(entry.enterMs, Math.max(MIN_ENTER_MS, durationMs - startMs));
    let exit = entry.exit ?? null;
    let exitAtMs = entry.exitAtMs;
    if (exit === "none") {
      exit = null;
      exitAtMs = null;
    }
    if (exit !== null && exitAtMs === null) {
      issues.push(`layer "${entry.layerId}": exit effect without an exit time`);
      continue;
    }
    if (exit === null) exitAtMs = null;
    if (exitAtMs !== null) {
      if (exitAtMs <= startMs + enterMs) {
        issues.push(`layer "${entry.layerId}": exit at ${exitAtMs} ms before the end of the entrance (${startMs + enterMs} ms)`);
        continue;
      }
      if (exitAtMs > durationMs) exitAtMs = durationMs;
    }
    out.push({ layerId: entry.layerId, enter: entry.enter, startMs, enterMs, exit, exitAtMs });
  }
  if (issues.length > 0) throw new TimelineValidationError(issues);
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** Describes the timeline to the model (revision) or to the author. */
export function describeTimeline(timeline: Timeline): string {
  if (timeline.length === 0) return "(no animated layer)";
  return timeline
    .map(
      (t) =>
        `${t.layerId}: ${t.enter} at ${t.startMs} ms (${t.enterMs} ms)${t.exit && t.exitAtMs !== null ? `, exits with ${t.exit} at ${t.exitAtMs} ms` : ", stays until the end"}`
    )
    .join("\n");
}
