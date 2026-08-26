/**
 * docs/SPEC_SERIES_ET_ROLES.md §3 — migration de données (pas de schéma) : impose l'invariant
 * « exactement un rôle par série ». Pour chaque série (archivée ou non) liée à plus d'une catégorie,
 * garde la catégorie de plus fort poids (égalité : label ASC) et supprime les autres liens.
 * Idempotent : un second passage ne trouve plus rien à faire.
 *
 * Usage : node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/migrate-series-single-role.ts [--dry-run]
 */
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contentSeriesCategories } from "@/db/schema";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const allSeries = await db.query.contentSeries.findMany({
    columns: { id: true, label: true, userId: true, archived: true },
    with: {
      contentSeriesCategories: {
        with: { category: { columns: { id: true, label: true, weight: true } } },
      },
    },
  });

  let touched = 0;
  for (const series of allSeries) {
    const links = series.contentSeriesCategories;
    if (links.length <= 1) continue;

    const sorted = [...links].sort(
      (a, b) => b.category.weight - a.category.weight || a.category.label.localeCompare(b.category.label)
    );
    const keep = sorted[0];
    const drop = sorted.slice(1);

    console.log(
      `[${series.archived ? "archivée" : "active"}] « ${series.label} » (${series.id}) : garde « ${keep.category.label} », retire ${drop
        .map((d) => `« ${d.category.label} »`)
        .join(", ")}`
    );
    touched++;

    if (!dryRun) {
      await db.delete(contentSeriesCategories).where(
        and(
          eq(contentSeriesCategories.seriesId, series.id),
          inArray(
            contentSeriesCategories.categoryId,
            drop.map((d) => d.category.id)
          )
        )
      );
    }
  }

  const orphans = allSeries.filter((s) => !s.archived && s.contentSeriesCategories.length === 0);
  for (const s of orphans) {
    console.warn(`Série active sans rôle (ignorée par le calendrier tant qu'un rôle n'est pas choisi) : « ${s.label} » (${s.id})`);
  }

  console.log(`\n${touched} série(s) ramenée(s) à un rôle${dryRun ? " (dry-run, rien écrit)" : ""}, ${orphans.length} série(s) active(s) sans rôle.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
