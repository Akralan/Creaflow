/**
 * Banc d'essai du fil narratif (docs/SPEC_FIL_NARRATIF.md §12) : écrit une SÉRIE ENTIÈRE du pack
 * MyKiné — origine, vision, épisodes, point d'étape, promesse tenue — pour qu'elle se juge d'un bloc,
 * et non post par post. Ne touche jamais la base : rien n'est écrit, tout sort dans un fichier.
 *
 * Le placement n'est pas rejoué ici (il est couvert par src/lib/narrative/placement.test.ts) : ce
 * banc force les quatre types sur des périmètres choisis à la main, pour juger L'ÉCRITURE.
 *
 * Usage : set -a && source .env && set +a && node_modules/.bin/tsx scripts/mykine-narrative.ts <sortie.txt> <forme.json>
 *
 * Les cinq critères à juger sur la sortie :
 *  1. origine     — le produit n'apparaît pas avant la dernière phrase ; le déclencheur est dans la matière
 *  2. vision      — chaque affirmation sur l'avenir s'appuie sur une décision de la ligne de temps
 *  3. point d'étape — aucun épisode n'est re-raconté ; ce qui a changé est dit avec les faits du périmètre
 *  4. promesse    — la phrase citée est exactement celle du post ; l'événement cité la tient
 *  5. la série lue d'un bloc — pas deux posts avec le même squelette, pas de chiffre repris d'un voisin
 */
import fs from "node:fs";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, creatorProfiles, materialEvents, sourceMaterials, users } from "@/db/schema";
import { readersOfProduct } from "@/lib/services/seriesReaderService";
import { describeSeriesForm, parseStoredSeriesForm, type SeriesForm } from "@/lib/llm/seriesForm";
import { writeNarrativePost, type NarrativeBrief } from "@/lib/llm/narrativeWriter";
import { writeScriptFromEvent, type BriefEvent, type EventBrief } from "@/lib/llm/eventWriter";
import type { NarrativeKind } from "@/lib/narrative/placement";

const SERIES_ID = "c287de89-914d-4357-9339-7fb1b8902a15"; // MyKiné en construction
const READER_LABEL = "Développeurs santé et vision";

/** L'ordre de lecture du banc : la série telle qu'un lecteur la recevrait. */
type Step =
  | { kind: "episode"; date: string }
  | { kind: NarrativeKind; dates: string[]; promise?: string };

const SERIES: Step[] = [
  { kind: "origin", dates: ["2025-11-16"] },
  { kind: "episode", date: "2025-11-23" },
  { kind: "vision", dates: ["2025-11-23", "2025-12-06"] },
  { kind: "episode", date: "2025-12-06" },
  { kind: "checkpoint", dates: ["2025-11-16", "2025-11-23", "2025-12-06"] },
  // La promesse doit exister pour de vrai dans un post d'épisode : celle-ci est reprise mot pour mot
  // du post généré à l'étape 2 (à ajuster après un premier passage, cf. §12).
  { kind: "promise", dates: ["2025-12-06"], promise: "Je dirai dans un prochain épisode si le traitement déplacé tient sur un vieux téléphone." },
];

async function main() {
  const [outFile, formFile] = [process.argv[2], process.argv[3]];
  if (!outFile || !formFile) throw new Error("Donne un fichier de sortie et un fichier de forme.");
  const user = await db.query.users.findFirst({ where: eq(users.email, "mykine.test@example.com"), columns: { id: true } });
  if (!user) throw new Error("Compte de test introuvable.");

  const series = await db.query.contentSeries.findFirst({
    where: eq(contentSeries.id, SERIES_ID),
    with: { product: true, contentSeriesPlatforms: { columns: { platform: true } } },
  });
  if (!series?.productId) throw new Error("Série introuvable.");
  const reader = readersOfProduct(series.product).find((r) => r.label === READER_LABEL);
  if (!reader) throw new Error("Lecteur introuvable.");

  const all = await db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, user.id), eq(materialEvents.productId, series.productId)),
    orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
  });
  const toBrief = (e: (typeof all)[number]): BriefEvent => ({ id: e.id, date: e.date, datePrecision: e.datePrecision, title: e.title, whatHappened: e.whatHappened, whatChanged: e.whatChanged, kind: e.kind });
  const dated = all.map(toBrief).filter((e) => e.date !== null);

  let form: SeriesForm;
  if (fs.existsSync(formFile)) {
    const stored = parseStoredSeriesForm(JSON.parse(fs.readFileSync(formFile, "utf-8")));
    if (!stored) throw new Error("Forme illisible.");
    form = stored;
  } else {
    const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, user.id), columns: { brandName: true, activityType: true } });
    form = await describeSeriesForm({
      brandName: profile?.brandName ?? "l'auteur",
      activityType: profile?.activityType ?? "",
      subjectName: series.product?.name ?? series.label,
      subjectDescription: series.product?.description ?? null,
      reader,
      seriesLabel: series.label,
      seriesDescription: series.description,
      platforms: series.contentSeriesPlatforms.map((p) => p.platform),
      sampleEvents: all.filter((e) => e.audiences.length === 0 || e.audiences.includes(READER_LABEL)).map((e) => e.title).slice(0, 12),
    });
    fs.writeFileSync(formFile, JSON.stringify(form, null, 2), "utf-8");
  }

  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, user.id), columns: { brandName: true, activityType: true } });
  const common = {
    brandName: profile?.brandName ?? "l'auteur",
    activityType: profile?.activityType ?? "",
    subjectName: series.product?.name ?? series.label,
    platform: "linkedin" as const,
    contentType: "text" as const,
    // Sans mémoire des derniers posts : le banc juge la série qu'il écrit, pas celle d'hier.
    recentPosts: [],
  };

  const sourcesOf = async (ids: string[]) => {
    const rows = await Promise.all(
      [...new Set(ids)].map((id) => db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.id, id), columns: { id: true, title: true, rawText: true } }))
    );
    return rows.filter((r): r is NonNullable<typeof r> => Boolean(r)).map((r) => ({ id: r.id, title: r.title, text: r.rawText }));
  };

  const out: string[] = [`Généré le ${new Date().toISOString()} — modèle ${process.env.OPENAI_MODEL ?? "?"} — lecteur : ${READER_LABEL}`, ""];
  let previousEpisode = "";

  for (const [rank, step] of SERIES.entries()) {
    if (step.kind === "episode") {
      const row = all.find((e) => e.date === step.date);
      if (!row) throw new Error(`Événement introuvable : ${step.date}`);
      const index = dated.findIndex((e) => e.id === row.id);
      const source = row.sourceMaterialId ? (await sourcesOf([row.sourceMaterialId]))[0] ?? null : null;
      const brief: EventBrief = {
        event: toBrief(row),
        before: index > 0 ? dated.slice(Math.max(0, index - 2), index) : [],
        after: index >= 0 ? dated.slice(index + 1, index + 2) : [],
        reader,
        form,
        seriesLabel: series.label,
        source,
        timeline: dated,
      };
      const generated = await writeScriptFromEvent({ ...common, brief });
      if (generated.contentType !== "text") throw new Error("Post texte attendu.");
      previousEpisode = generated.caption.trim();
      out.push("=".repeat(80), `Post ${rank + 1} — ÉPISODE (${row.date} — ${row.title})`, `TITRE : ${generated.title}`, "", previousEpisode, "");
      console.log("OK épisode", row.title);
      continue;
    }

    const rows = step.dates.map((d) => {
      const row = all.find((e) => e.date === d);
      if (!row) throw new Error(`Événement introuvable : ${d}`);
      return row;
    });
    const brief: NarrativeBrief = {
      kind: step.kind,
      scope: rows.map(toBrief),
      subject: {
        name: series.product?.name ?? series.label,
        description: series.product?.description ?? null,
        problem: series.product?.problem ?? null,
        valueProposition: series.product?.valueProposition ?? null,
      },
      promise: step.promise ? { text: step.promise, postText: previousEpisode } : null,
      reader,
      form,
      seriesLabel: series.label,
      sources: await sourcesOf(rows.map((r) => r.sourceMaterialId).filter((id): id is string => Boolean(id))),
    };
    const generated = await writeNarrativePost({ ...common, brief });
    if (generated.contentType !== "text") throw new Error("Post texte attendu.");
    const trace = generated.trace as unknown as { drafts?: unknown[]; checks?: unknown } | undefined;
    out.push(
      "=".repeat(80),
      `Post ${rank + 1} — ${step.kind.toUpperCase()} (périmètre : ${step.dates.join(", ")})`,
      `TITRE : ${generated.title}`,
      "",
      generated.caption.trim(),
      "",
      `PROMESSES DÉCLARÉES : ${JSON.stringify(generated.promisesMade)}`,
      `TRACE : brouillons ${trace?.drafts?.length ?? "?"}, contrôles ${JSON.stringify(trace?.checks)}`,
      ""
    );
    console.log("OK", step.kind);
  }

  fs.writeFileSync(outFile, out.join("\n"), "utf-8");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
