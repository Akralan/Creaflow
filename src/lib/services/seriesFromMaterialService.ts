import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries } from "@/db/schema";
import { planNarrativeForSubject } from "@/lib/services/narrativeDirector";
import { getMaterialForSubject } from "@/lib/services/sourceMaterialService";
import { ApiError } from "@/lib/api/errors";

const DEFAULT_SERIES_WEIGHT = 15;

export interface GenerateSeriesFromMaterialParams {
  productId?: string | null;
  seriesId?: string;
  newSeries?: { label: string; description: string; weight?: number };
}

/**
 * « Série depuis la matière » (docs/SPEC_REDACTEUR_EN_CHEF.md §4.4) — remplace le mécanisme one-shot
 * `propose_series_episodes` (qui générait N scripts complets synchrones en une requête). Crée
 * désormais le `NarrativeState` de la série (mode feuilleton — une série née de la matière est par
 * nature une progression) et lance une planification glissante (§3.2) : le résultat est un PLAN de
 * beats, pas des scripts déjà générés. La génération réelle suit le flux normal (créneau/génération
 * libre), qui pioche dans ce plan via le choix du jour (§3.3, Lot B3).
 */
export async function generateSeriesFromMaterial(userId: string, params: GenerateSeriesFromMaterialParams) {
  if (!params.seriesId && !params.newSeries) {
    throw new ApiError(400, "Précise une série existante ou les informations d'une nouvelle série.");
  }

  let series: typeof contentSeries.$inferSelect;
  if (params.seriesId) {
    const found = await db.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, params.seriesId), eq(contentSeries.userId, userId)),
    });
    if (!found) {
      throw new ApiError(404, "Série introuvable.");
    }
    series = found;
  } else {
    const [created] = await db
      .insert(contentSeries)
      .values({
        userId,
        label: params.newSeries!.label,
        description: params.newSeries!.description,
        weight: params.newSeries!.weight ?? DEFAULT_SERIES_WEIGHT,
        // Une série née d'un corpus de matière raconte une progression par construction — feuilleton,
        // pas le défaut rendez_vous générique (§1 : l'inférence LLM normale, Annexe B.8, ne s'applique
        // qu'à la génération globale de séries depuis l'activité, pas à ce geste dédié).
        mode: "feuilleton",
      })
      .returning();
    series = created;
  }

  const documents = await getMaterialForSubject(userId, params.productId ?? null);
  if (documents.length === 0) {
    throw new ApiError(400, "Aucune matière disponible pour ce sujet — colle du texte ou fais une interview d'abord.");
  }

  const state = await planNarrativeForSubject(userId, { productId: params.productId ?? null, seriesId: series.id });

  // Forme alignée sur listActiveSeriesForUser (categories/platforms/narrativeState) — cette série
  // n'est encore rattachée à aucune catégorie/plateforme à ce stade (même limite que l'ancien
  // mécanisme one-shot, pas introduite par ce remplacement).
  return { series: { ...series, categories: [] as { id: string; label: string }[], platforms: [] as string[], narrativeState: state }, state };
}
