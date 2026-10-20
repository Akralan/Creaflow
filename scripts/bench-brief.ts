/**
 * Banc d'essai du brief du rédacteur, hors application : les mêmes trois événements passés par le
 * VRAI chemin de génération (`buildEventBriefForSeries` + `generateScript`), sans rien écrire en base.
 *
 * Sert à comparer deux états du code (branche A = tel quel, branche B = brief modifié) sur une
 * matière identique. Les trois événements sont choisis parce que leur passage du devlog contient un
 * détail humain que le post devrait garder : « quand même » et le salon (16/11), le caleçon (23/11),
 * le tremblement qui fait compter trois fois (06/12).
 *
 * Usage : node_modules/.bin/tsx --env-file=.env scripts/bench-brief.ts <sortie.txt> [étiquette]
 */
import fs from "node:fs";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contentSeries, materialEvents, products, users } from "@/db/schema";
import { buildGenerationContext } from "@/lib/services/scriptService";
import { generateScript } from "@/lib/llm/generateScript";
import { buildEventBriefForSeries } from "@/lib/services/seriesReaderService";

const EMAIL = "mykine.demo@example.com";
const SERIES_LABEL = "Build log";
const EVENT_DATES = ["2025-11-16", "2025-11-23", "2025-12-06"];

/** Le détail humain du passage source, par événement : ce qu'un post qui a lu garderait. */
const HUMAN_DETAILS: Record<string, string[]> = {
  "2025-11-16": ["quand même", "salon", "20 squats"],
  "2025-11-23": ["caleçon", "sous-vetement", "en slip"],
  "2025-12-06": ["tremble", "tremblement", "compte trois", "trois fois"],
};

const LABEL_AT_PARAGRAPH_START = /^[A-ZÀ-ÖØ-Þ][^.!?\n]{0,45}\s?:\s/;
const SCREAMING_IDENT = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const ASSIGNMENT = /\b[A-Za-z_][A-Za-z0-9_]*\s*=\s*[-\d]/g;

function score(text: string, date: string) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const labels = paragraphs.filter((p) => LABEL_AT_PARAGRAPH_START.test(p));
  const idents = [...new Set([...(text.match(SCREAMING_IDENT) ?? []), ...(text.match(ASSIGNMENT) ?? [])])];
  // Normalisé : le modèle écrit « sous‑vêtements » avec un tiret insécable et au pluriel, et le
  // premier scoreur comptait zéro là où le détail était bien présent.
  const flat = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[‑–—-]/g, "-");
  const kept = (HUMAN_DETAILS[date] ?? []).filter((d) => flat(text).includes(flat(d)));
  const sentences = text.split(/(?<=[.!?…])\s+/).filter((s) => s.trim().length > 0);
  const lengths = sentences.map((s) => s.trim().length);
  const mean = lengths.reduce((a, b) => a + b, 0) / Math.max(1, lengths.length);
  const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, lengths.length));
  return {
    paragraphs: paragraphs.length,
    labelled: labels.length,
    labels: labels.map((p) => p.slice(0, p.indexOf(":") + 1)),
    codeIdents: idents,
    humanDetailsKept: kept,
    humanDetailsLooked: HUMAN_DETAILS[date] ?? [],
    chars: text.length,
    sentences: sentences.length,
    sentenceLenMean: Math.round(mean),
    sentenceLenSd: Math.round(sd),
  };
}

async function main() {
  const outFile = process.argv[2];
  const arm = process.argv[3] ?? "sans étiquette";
  if (!outFile) throw new Error("Donne un fichier de sortie.");

  const user = await db.query.users.findFirst({ where: eq(users.email, EMAIL), columns: { id: true } });
  if (!user) throw new Error(`Compte ${EMAIL} introuvable.`);
  const series = await db.query.contentSeries.findFirst({ where: and(eq(contentSeries.userId, user.id), eq(contentSeries.label, SERIES_LABEL)) });
  if (!series?.productId) throw new Error(`Série « ${SERIES_LABEL} » introuvable ou sans sujet.`);
  const product = await db.query.products.findFirst({ where: eq(products.id, series.productId), columns: { name: true } });
  const all = await db.query.materialEvents.findMany({
    where: and(eq(materialEvents.userId, user.id), eq(materialEvents.productId, series.productId)),
    orderBy: [sql`${materialEvents.date} asc nulls last`, asc(materialEvents.createdAt)],
  });

  const out: string[] = [
    `BANC D'ESSAI DU BRIEF — branche « ${arm} »`,
    `${new Date().toISOString()} · modèle ${process.env.OPENAI_MODEL ?? "?"} · sujet ${product?.name} · série ${SERIES_LABEL} · lecteur ${series.readerLabel}`,
    `Mémoire des derniers posts neutralisée (recentPosts = []) pour que les branches ne se contaminent pas.`,
    "",
  ];
  const scores: Array<ReturnType<typeof score> & { date: string }> = [];

  for (const date of EVENT_DATES) {
    const row = all.find((e) => e.date === date);
    if (!row) throw new Error(`Événement introuvable : ${date}`);
    const brief = await buildEventBriefForSeries(user.id, series.id, row.id);
    if (!brief) throw new Error(`Brief nul pour ${date}`);

    const context = await buildGenerationContext(user.id, "linkedin", null, "text", null, undefined, series.id);
    context.eventBrief = brief;
    context.recentPosts = [];
    // Même rattrapage que le vrai chemin (postPairService) : il arrive que le rédacteur conclue en
    // prose au lieu d'appeler son outil, et un essai ne doit pas se perdre pour ça.
    const generated = await generateScript(context).catch((error) => {
      if (!(error instanceof Error) || !error.message.includes("submitted no post")) throw error;
      console.log("  (rien soumis, second essai — " + date + ")");
      return generateScript(context);
    });
    if (generated.contentType !== "text") throw new Error("Post texte attendu.");

    const full = `${generated.hookText}\n\n${generated.caption}`.trim();
    const hookRepeated = generated.caption.trim().startsWith(generated.hookText.trim());
    const s = { ...score(full, date), date, hookRepeated };
    scores.push(s);
    const trace = generated.trace as unknown as { drafts?: unknown[]; submissions?: number; checks?: unknown } | undefined;
    out.push(
      "=".repeat(100),
      `${date} — ${row.title}`,
      `at_stake en base : ${row.atStake ? row.atStake : "∅"}`,
      "=".repeat(100),
      full,
      "",
      `HASHTAGS : ${generated.hashtags.join(" ")}`,
      `TRACE : ${trace?.drafts?.length ?? "?"} brouillon(s), ${trace?.submissions ?? "?"} soumission(s), fautes restantes ${JSON.stringify((trace?.checks as { failures?: unknown })?.failures)}`,
      `ACCROCHE RECOPIÉE EN TÊTE DU TEXTE : ${hookRepeated ? "oui" : "non"}`,
      `SCORE : ${s.paragraphs} paragraphes, ${s.labelled} étiquetés ${JSON.stringify(s.labels)}, code ${JSON.stringify(s.codeIdents)}, détails humains gardés ${JSON.stringify(s.humanDetailsKept)} sur ${JSON.stringify(s.humanDetailsLooked)}, ${s.chars} car., phrases moy. ${s.sentenceLenMean} ± ${s.sentenceLenSd}`,
      ""
    );
    console.log(`OK ${date} — étiquetés ${s.labelled}/${s.paragraphs}, code ${s.codeIdents.length}, détails ${s.humanDetailsKept.length}/${s.humanDetailsLooked.length}`);
  }

  const sum = (f: (s: (typeof scores)[number]) => number) => scores.reduce((a, s) => a + f(s), 0);
  out.push(
    "─".repeat(100),
    `TOTAL branche « ${arm} » sur ${scores.length} posts`,
    "─".repeat(100),
    `paragraphes étiquetés : ${sum((s) => s.labelled)} / ${sum((s) => s.paragraphs)}`,
    `identifiants de code  : ${sum((s) => s.codeIdents.length)}`,
    `détails humains gardés: ${sum((s) => s.humanDetailsKept.length)} / ${sum((s) => s.humanDetailsLooked.length)}`,
    `longueur de phrase    : moyenne ${Math.round(sum((s) => s.sentenceLenMean) / scores.length)}, écart-type moyen ${Math.round(sum((s) => s.sentenceLenSd) / scores.length)}`,
    ""
  );
  fs.writeFileSync(outFile, out.join("\n"), "utf-8");
  console.log(`\nécrit : ${outFile}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
