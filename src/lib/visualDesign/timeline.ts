import { z } from "zod";
import { MAX_DURATION_MS, MIN_DURATION_MS } from "./visualFormat";

/**
 * Ligne de temps d'une maquette animée (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md §2 « Le modèle de
 * l'animation ») : une entrée par calque qui apparaît ou disparaît. Un calque absent est visible du
 * début à la fin. Objet séparé du HTML — jamais de CSS d'animation dans les slides.
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
    super(`Ligne de temps refusée : ${issues.join(" · ")}`);
    this.name = "TimelineValidationError";
    this.issues = issues;
  }
}

/**
 * Valide et normalise : calques existants, un seul passage par calque, temps dans la durée, sortie
 * après l'entrée, tri par début. Lève TimelineValidationError avec la liste des problèmes (renvoyée
 * au modèle pour une seconde tentative, ou en 422 à une écriture manuelle).
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
      issues.push(`calque « ${entry.layerId} » inconnu`);
      continue;
    }
    if (seen.has(entry.layerId)) {
      issues.push(`calque « ${entry.layerId} » présent deux fois`);
      continue;
    }
    seen.add(entry.layerId);
    if (entry.startMs >= durationMs) {
      issues.push(`calque « ${entry.layerId} » : début ${entry.startMs} ms au-delà de la durée ${durationMs} ms`);
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
      issues.push(`calque « ${entry.layerId} » : effet de sortie sans instant de sortie`);
      continue;
    }
    if (exit === null) exitAtMs = null;
    if (exitAtMs !== null) {
      if (exitAtMs <= startMs + enterMs) {
        issues.push(`calque « ${entry.layerId} » : sortie à ${exitAtMs} ms avant la fin de l'entrée (${startMs + enterMs} ms)`);
        continue;
      }
      if (exitAtMs > durationMs) exitAtMs = durationMs;
    }
    out.push({ layerId: entry.layerId, enter: entry.enter, startMs, enterMs, exit, exitAtMs });
  }
  if (issues.length > 0) throw new TimelineValidationError(issues);
  return out.sort((a, b) => a.startMs - b.startMs);
}

/** Décrit la ligne de temps au modèle (révision) ou à l'auteur. */
export function describeTimeline(timeline: Timeline): string {
  if (timeline.length === 0) return "(aucun calque animé)";
  return timeline
    .map(
      (t) =>
        `${t.layerId} : ${t.enter} à ${t.startMs} ms (${t.enterMs} ms)${t.exit && t.exitAtMs !== null ? `, sort en ${t.exit} à ${t.exitAtMs} ms` : ", reste jusqu'à la fin"}`
    )
    .join("\n");
}
