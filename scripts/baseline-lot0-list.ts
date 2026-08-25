/**
 * Lot 0 (docs/SPEC_PROMPT_GENERATION_TECH.md §7) — étape de repérage.
 * Liste les profils créateurs, leurs sujets/produits, catégories de contenu et volume de matière
 * disponible, pour choisir 3-5 briefs contrastés à rejouer en baseline.
 *
 * Usage : node_modules/.bin/tsx scripts/baseline-lot0-list.ts
 */
import { db } from "@/db";
import { products, sourceMaterials, contentCategories, contentSeries } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";

async function main() {
  const profiles = await db.query.creatorProfiles.findMany();

  for (const profile of profiles) {
    console.log(`\n=== Profil ${profile.userId} — ${profile.brandName} (${profile.activityType}) ===`);

    const brandMaterial = await db.query.sourceMaterials.findMany({
      where: and(eq(sourceMaterials.userId, profile.userId), isNull(sourceMaterials.productId)),
      columns: { id: true, title: true, kind: true },
    });
    console.log(`  Matière niveau marque : ${brandMaterial.length} document(s)`);

    const userProducts = await db.query.products.findMany({
      where: eq(products.userId, profile.userId),
    });

    for (const product of userProducts) {
      const material = await db.query.sourceMaterials.findMany({
        where: and(eq(sourceMaterials.userId, profile.userId), eq(sourceMaterials.productId, product.id)),
        columns: { id: true, title: true, kind: true },
      });
      console.log(
        `  Produit "${product.name}" (id=${product.id}) — ${material.length} document(s) de matière` +
          (material.length ? ` : ${material.map((m) => `${m.kind}${m.title ? `:${m.title}` : ""}`).join(", ")}` : "")
      );
    }

    const categories = await db.query.contentCategories.findMany({
      where: and(eq(contentCategories.userId, profile.userId), eq(contentCategories.archived, false)),
      columns: { id: true, label: true, materialHungry: true },
    });
    console.log(`  Catégories actives : ${categories.map((c) => `${c.label}${c.materialHungry ? "*" : ""} (id=${c.id})`).join(" | ")}`);

    const series = await db.query.contentSeries.findMany({
      where: and(eq(contentSeries.userId, profile.userId), eq(contentSeries.archived, false)),
      columns: { id: true, label: true },
    });
    if (series.length) {
      console.log(`  Séries actives : ${series.map((s) => `${s.label} (id=${s.id})`).join(" | ")}`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
