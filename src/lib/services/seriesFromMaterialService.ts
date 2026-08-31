import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { contentCategories, contentSeries, contentSeriesCategories } from "@/db/schema";
import { planNarrativeForSubject } from "@/lib/services/narrativeDirector";
import { getMaterialForSubject } from "@/lib/services/sourceMaterialService";
import { ApiError } from "@/lib/api/errors";

const DEFAULT_SERIES_WEIGHT = 15;

export interface GenerateSeriesFromMaterialParams {
  productId?: string | null;
  seriesId?: string;
  /** `categoryId` : rôle unique de la série créée (docs/SPEC_SERIES_ET_ROLES.md §1) — sans lui, la
   *  série n'existerait pour aucun calendrier. */
  newSeries?: { label: string; description: string; categoryId: string; weight?: number };
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
  let category: { id: string; label: string } | null;
  if (params.seriesId) {
    const existing = await db.query.contentSeries.findFirst({
      where: and(eq(contentSeries.id, params.seriesId), eq(contentSeries.userId, userId)),
      with: { contentSeriesCategories: { with: { category: { columns: { id: true, label: true } } }, limit: 1 } },
    });
    if (!existing) {
      throw new ApiError(404, "Série introuvable.");
    }
    const { contentSeriesCategories: joins, ...rest } = existing;
    category = joins[0]?.category ?? null;
    let found: typeof contentSeries.$inferSelect = rest;
    // Un sujet fourni ici est un geste explicite ("planifie CETTE série depuis la matière de CE
    // sujet") — met à jour le lien série↔sujet en conséquence (sélecteur de sujet,
    // docs/SPEC_REDACTEUR_EN_CHEF.md), pas seulement un scoping ponctuel de cet appel.
    if (params.productId !== undefined && params.productId !== found.productId) {
      const [updated] = await db
        .update(contentSeries)
        .set({ productId: params.productId })
        .where(eq(contentSeries.id, found.id))
        .returning();
      found = updated;
    }
    series = found;
  } else {
    const role = await db.query.contentCategories.findFirst({
      where: and(eq(contentCategories.id, params.newSeries!.categoryId), eq(contentCategories.userId, userId)),
      columns: { id: true, label: true },
    });
    if (!role) {
      throw new ApiError(404, "Rôle introuvable.");
    }
    category = role;
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
        // Sujet lié dès la création (sélecteur de sujet) — le sujet dont cette série tire sa matière.
        productId: params.productId ?? null,
      })
      .returning();
    await db.insert(contentSeriesCategories).values({ seriesId: created.id, categoryId: role.id });
    series = created;
  }

  const documents = await getMaterialForSubject(userId, series.productId);
  if (documents.length === 0) {
    throw new ApiError(400, "Aucune matière disponible pour ce sujet — colle du texte ou fais une interview d'abord.");
  }

  // Pas de productId explicite ici : narrativeDirector.ts::resolveSubject le dérive automatiquement
  // de `series.productId` (qu'on vient de garantir à jour ci-dessus) — l'état narratif d'une série
  // reste toujours identifié par son seriesId seul (voir le commentaire sur resolveSubject).
  const state = await planNarrativeForSubject(userId, { seriesId: series.id });

  // Forme alignée sur listActiveSeriesForUser (category/platforms/narrativeState/product) — aucune
  // plateforme à ce stade. `product` à `null` même si productId est renseigné : l'appelant redirige
  // vers /direction juste après, qui relit la forme jointe exacte.
  return {
    series: {
      ...series,
      category,
      platforms: [] as string[],
      narrativeState: state,
      product: null as { id: string; name: string } | null,
    },
    state,
  };
}
