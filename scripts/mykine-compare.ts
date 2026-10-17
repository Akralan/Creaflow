/**
 * Régénère trois posts de la série « MyKiné en construction » (cible développeurs) avec le rédacteur
 * par événements tel qu'il est dans le code, sans rien écrire en base. Mêmes trois événements que
 * les premiers posts développeurs sauvegardés (AVANT_posts_actuels.txt).
 *
 * La série est revenue sur le lecteur kiné depuis ; le brief est donc reconstruit ici avec le
 * lecteur « Développeurs santé et vision » et une forme écrite une fois pour lui, gardée dans un
 * fichier pour que l'avant et l'après aient exactement la même.
 *
 * Usage : set -a && source .env && set +a && node_modules/.bin/tsx scripts/mykine-compare.ts <sortie.txt> <forme.json>
 */
import fs from "node:fs";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, creatorProfiles, materialEvents, sourceMaterials, users } from "@/db/schema";
import { buildGenerationContext } from "@/lib/services/scriptService";
import { generateScript } from "@/lib/llm/generateScript";
import { readersOfProduct } from "@/lib/services/seriesReaderService";
import { describeSeriesForm, parseStoredSeriesForm, type SeriesForm } from "@/lib/llm/seriesForm";
import type { BriefEvent, EventBrief } from "@/lib/llm/eventWriter";

const SERIES_ID = "c287de89-914d-4357-9339-7fb1b8902a15"; // MyKiné en construction
const READER_LABEL = "Développeurs santé et vision";
// Les trois événements des trois premiers posts développeurs sauvegardés.
const EVENT_DATES_TITLES: Array<[string, string]> = [
  ["2025-11-16", "Le prototype rate une répétition"],
  ["2025-11-23", "Le traitement est déplacé"],
  ["2025-12-06", "Le tremblement fait compter"],
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
  const timeline = all.map(toBrief);
  const dated = timeline.filter((e) => e.date !== null);

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

  const out: string[] = [`Généré le ${new Date().toISOString()} — modèle ${process.env.OPENAI_MODEL ?? "?"} — lecteur : ${READER_LABEL}`, ""];
  for (const [date, titleStart] of EVENT_DATES_TITLES) {
    const row = all.find((e) => e.date === date && e.title.startsWith(titleStart));
    if (!row) throw new Error(`Événement introuvable : ${date} ${titleStart}`);
    const index = dated.findIndex((e) => e.id === row.id);
    const source = row.sourceMaterialId
      ? await db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.id, row.sourceMaterialId), columns: { id: true, title: true, rawText: true } })
      : null;
    const brief: EventBrief = {
      event: toBrief(row),
      before: index > 0 ? dated.slice(Math.max(0, index - 2), index) : [],
      after: index >= 0 ? dated.slice(index + 1, index + 2) : [],
      reader,
      form,
      seriesLabel: series.label,
      source: source ? { id: source.id, title: source.title, text: source.rawText } : null,
      timeline: dated,
    };
    const context = await buildGenerationContext(user.id, "linkedin", null, "text", null, null, SERIES_ID);
    context.eventBrief = brief;
    // Sans mémoire des derniers posts : sinon les posts déjà en base orienteraient l'un ou l'autre essai.
    context.recentPosts = [];
    const generated = await generateScript(context);
    if (generated.contentType !== "text") throw new Error("Post texte attendu.");
    const trace = generated.trace as unknown as { drafts?: unknown[]; checks?: unknown } | undefined;
    out.push(
      "=".repeat(80),
      `Événement : ${row.date} — ${row.title}`,
      `TITRE : ${generated.title}`,
      "",
      generated.caption.trim(),
      "",
      `HASHTAGS : ${generated.hashtags.join(" ")}`,
      `TRACE : brouillons ${trace?.drafts?.length ?? "?"}, contrôles ${JSON.stringify(trace?.checks)}`,
      ""
    );
    console.log("OK", row.title);
  }
  fs.writeFileSync(outFile, out.join("\n"), "utf-8");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
