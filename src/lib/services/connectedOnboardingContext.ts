import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { materialSources, oauthAccounts, products, sourceMaterials } from "@/db/schema";
import { identityProviderLabel } from "@/lib/oauth/registry";
import type { ConnectedOnboardingContext } from "@/lib/llm/onboardingChat";

/**
 * Contexte injecté au chat d'onboarding d'un compte né d'un fournisseur tiers : profil du compte et
 * sujets retenus, avec le début de leur matière déjà ingérée. L'extrait est relu en base, pas
 * refetché — la matière est déjà là, inutile de repayer un appel réseau.
 *
 * Vit dans services/ et non dans lib/verticals/ : `verticals/` est du code client (il rend du JSX)
 * et ne peut pas importer la base (docs/ARCHITECTURE_VERTICALES.md §4, chantier 2).
 */
export async function buildConnectedOnboardingContext(userId: string): Promise<ConnectedOnboardingContext> {
  // Un compte peut cumuler plusieurs identités ; celle qui compte ici est n'importe laquelle, elles
  // décrivent la même personne. `findFirst` sans tri est donc suffisant et volontaire.
  const account = await db.query.oauthAccounts.findFirst({ where: eq(oauthAccounts.userId, userId) });
  const sources = await db.query.materialSources.findMany({ where: eq(materialSources.userId, userId) });
  const productRows = await db.query.products.findMany({ where: eq(products.userId, userId) });

  const subjects: ConnectedOnboardingContext["subjects"] = [];
  for (const product of productRows) {
    const source = sources.find((s) => s.productId === product.id);
    // Le premier document ingéré, quel qu'il soit : chercher "README.md" en dur ne valait que pour
    // GitHub, et laissait Notion comme Linear sans extrait.
    const first = source
      ? await db.query.sourceMaterials.findFirst({
          where: and(eq(sourceMaterials.sourceId, source.id)),
          columns: { rawText: true },
        })
      : null;
    subjects.push({
      name: product.name,
      description: product.description,
      excerpt: first ? first.rawText.slice(0, 600) : null,
    });
  }

  return {
    providerLabel: account ? identityProviderLabel(account.provider) : "",
    login: account?.login ?? "",
    name: account?.name ?? null,
    bio: account?.bio ?? null,
    subjects,
  };
}
