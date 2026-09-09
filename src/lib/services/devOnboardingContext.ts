import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts, materialSources, products, sourceMaterials } from "@/db/schema";
import type { DevOnboardingContext } from "@/lib/llm/onboardingChat";

/**
 * Contexte injecté au chat d'onboarding dev : profil GitHub et sujets retenus, avec le début de
 * leur README déjà ingéré. Le README est retrouvé par son externalRef, pas par une relecture
 * GitHub — la matière est déjà là, inutile de repayer un appel réseau.
 *
 * Vit dans services/ et non dans lib/verticals/ : `verticals/` est du code client (il rend du JSX)
 * et ne peut pas importer la base (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2).
 */
export async function buildDevOnboardingContext(userId: string): Promise<DevOnboardingContext> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  const sources = await db.query.materialSources.findMany({ where: eq(materialSources.userId, userId) });
  const productRows = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const subjects: DevOnboardingContext["subjects"] = [];
  for (const product of productRows) {
    const source = sources.find((s) => s.productId === product.id);
    const readme = source
      ? await db.query.sourceMaterials.findFirst({
          where: and(eq(sourceMaterials.sourceId, source.id), eq(sourceMaterials.externalRef, "README.md")),
          columns: { rawText: true },
        })
      : null;
    subjects.push({
      name: product.name,
      description: product.description,
      // Le langage principal n'est pas persisté : il vient de l'API GitHub à la sélection et n'a pas
      // de colonne. Le nom et la description du dépôt portent déjà l'essentiel.
      language: null,
      readmeExcerpt: readme ? readme.rawText.slice(0, 600) : null,
    });
  }

  return {
    login: account?.login ?? "",
    name: account?.name ?? null,
    bio: account?.bio ?? null,
    subjects,
  };
}
