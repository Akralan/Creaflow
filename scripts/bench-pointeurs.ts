/**
 * Banc d'essai de l'événement-pointeur, hors application.
 *
 * Conception du fondateur, 2026-10-22 (worktree `evenements-pointeurs`), testée telle quelle :
 *  1. un événement est un fichier, une ligne, et peut-être une date — plus, depuis le 2026-10-24, son
 *     GENRE (docs/FORMES_ET_GENRES.md), la seule exception à « aucun champ » ;
 *  2. il n'y a plus de choisisseur séparé : le rédacteur choisit lui-même ses événements ;
 *  3. sa seule règle est qu'il fait du build in public pour la cible définie et le contexte du projet,
 *     et la forme de son post est celle du genre de l'événement choisi, lue avec `read_form` ;
 *  4. un événement utilisé par un post est marqué utilisé. C'est le seul état gardé.
 *
 * Le banc ne touche NI la base (aucune écriture) NI le chemin de génération de l'app. Il lit la
 * matière déjà déposée, extrait les pointeurs document par document en reportant la liste ouverte
 * (engagements, annonces, décisions) d'un document au suivant comme le fait le service, et enchaîne
 * N posts par projet en reportant les marques d'un post au suivant.
 *
 * Usage :
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/bench-pointeurs.ts [nbPosts] [projet…]
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/bench-pointeurs.ts 12 mykine-genres
 *
 * Projets : `mytwin`, `mykine`, `mykine-genres` (le pack MyKiné + docs/tests/mykine-pack/C/genres.md,
 * un événement par genre), `creaflow`. Sans argument : mytwin, mykine, creaflow.
 * Le modèle est celui d'OPENAI_MODEL (mettre gpt-6-luna).
 * Les lignes de temps sont mises en cache sous docs/tests/pointeurs/<projet>/timeline-v2.json :
 * supprimer le fichier pour forcer une nouvelle extraction. L'ancien timeline.json (sans genre) est ignoré.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatorProfiles, products, sourceMaterials } from "@/db/schema";
import { parseStoredReaderPortrait } from "@/lib/llm/readerPortrait";
import { extractPointers, type Pointer } from "@/lib/llm/pointerExtractor";
import { GENRES, type Genre } from "@/lib/llm/postForms";
import { writePost, type TimelineEntry, type WrittenPost } from "@/lib/llm/pointerPostWriter";
import { keepOldestTrigger, openEventsFor, type GenreEventRow } from "@/lib/services/eventGenres";

const OUT_ROOT = path.join("docs", "tests", "pointeurs");

interface Corpus {
  key: string;
  brandName: string;
  projectName: string;
  projectContext: string;
  readerLabel: string;
  readerWho: string;
  /** Langue imposée au rédacteur. Le banc n'en avait pas et le modèle tirait au hasard : FR, EN,
   *  FR, FR sur quatre runs du même sujet. */
  language: "fr" | "en";
  docs: Array<{ file: string; text: string }>;
}

/** Un pointeur du banc : celui de l'extracteur plus un id stable, le même que la ligne de temps. */
type BenchPointer = Pointer & { id: string };

/** Le contexte et la cible de CreaFlow/tellovo : il n'a pas de fiche sujet en base, contrairement
 *  aux deux autres. Repris de docs/PRODUCT.md §1.1-1.2 — à corriger ici si ce n'est pas ce que
 *  l'auteur dirait de son propre projet. */
const CREAFLOW = {
  brandName: "tellovo",
  projectName: "CreaFlow",
  projectContext: `CreaFlow turns the material a founder already produces — project notes, specs, a devlog, decisions, numbers — into social posts, instead of asking them to come up with ideas. It only writes from what it was actually given, and never invents a fact it was not handed.
The problem it solves: founders and independents accumulate lived material and never publish it, and a generator fed only a product description has two options, stay generic or invent plausible details.`,
  readerLabel: "Indie developers building in public",
  readerWho: "developers and solo founders who ship a product publicly and want to post about it without spending their evening writing",
  language: "fr" as const,
};

function readLocalDocs(): Array<{ file: string; text: string }> {
  const docs: Array<{ file: string; text: string }> = [];
  const log = execFileSync("git", ["log", "--date=short", "--pretty=format:%ad %h %s"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  docs.push({ file: "commit-log.txt", text: log });
  for (const name of fs.readdirSync("docs").filter((f) => f.endsWith(".md")).sort()) {
    docs.push({ file: `docs/${name}`, text: fs.readFileSync(path.join("docs", name), "utf8") });
  }
  return docs;
}

/**
 * Le sujet en base : par nom, ou, quand plusieurs comptes de test portent le même nom, celui qui
 * possède un document donné (le pack MyKiné est celui qui a `devlog.md`).
 */
async function findProduct(productName: string, ownsDocument?: string) {
  if (ownsDocument) {
    const owner = await db.query.sourceMaterials.findFirst({ where: eq(sourceMaterials.title, ownsDocument), columns: { productId: true } });
    if (owner?.productId) {
      const product = await db.query.products.findFirst({ where: eq(products.id, owner.productId) });
      if (product?.name === productName) return product;
    }
  }
  return db.query.products.findFirst({ where: eq(products.name, productName) });
}

async function loadDbCorpus(key: string, productName: string, opts: { ownsDocument?: string; extraLocalDocs?: string[] } = {}): Promise<Corpus> {
  const product = await findProduct(productName, opts.ownsDocument);
  if (!product) throw new Error(`Sujet "${productName}" absent de la base.`);
  const reader = parseStoredReaderPortrait(product.readerPortrait)?.readers?.[0];
  if (!reader) throw new Error(`Sujet "${productName}" sans portrait de lecteurs : pas de cible définie.`);
  const materials = await db.query.sourceMaterials.findMany({ where: eq(sourceMaterials.productId, product.id) });
  // Ce que l'auteur dit lui-même de sa publication (creator_profiles.expectations, la question
  // « pourquoi tu publies » de /start) : le rédacteur ne peut pas le trouver dans le dépôt.
  const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, product.userId) });
  const context = [
    product.description,
    product.problem ? `The problem it solves: ${product.problem}` : null,
    profile?.expectations ? `What its author says about publishing: ${profile.expectations}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const docs = materials
    .filter((m) => (m.rawText ?? "").trim().length > 0)
    .map((m) => ({ file: m.title ?? m.id, text: m.rawText as string }));
  for (const local of opts.extraLocalDocs ?? []) {
    docs.push({ file: path.basename(local), text: fs.readFileSync(local, "utf8") });
  }
  return {
    key,
    brandName: productName,
    projectName: productName,
    projectContext: context,
    readerLabel: reader.label,
    readerWho: reader.who,
    language: profile?.language === "en" ? "en" : "fr",
    docs,
  };
}

async function loadCorpus(key: string): Promise<Corpus> {
  if (key === "mytwin") return loadDbCorpus(key, "MyTwin Leaderboard");
  if (key === "mykine") return loadDbCorpus(key, "MyKiné", { ownsDocument: "devlog.md" });
  if (key === "mykine-genres") {
    // Le pack MyKiné plus la matière de banc du chantier formes et genres : un événement par genre,
    // un engagement et l'événement qui le tient, une décision et l'événement qui y revient.
    return loadDbCorpus(key, "MyKiné", { ownsDocument: "devlog.md", extraLocalDocs: [path.join("docs", "tests", "mykine-pack", "C", "genres.md")] });
  }
  if (key === "creaflow") {
    // Même source que les deux autres pour ce que l'auteur dit de sa publication : le profil
    // tellovo.demo, celui que scripts/app-path-ingest.ts a créé.
    const profile = await db.query.creatorProfiles.findFirst({
      where: eq(creatorProfiles.userId, sql`(select id from users where email = 'tellovo.demo@example.com')`),
    });
    const projectContext = [CREAFLOW.projectContext, profile?.expectations ? `What its author says about publishing: ${profile.expectations}` : null]
      .filter(Boolean)
      .join("\n");
    return { ...CREAFLOW, projectContext, key, docs: readLocalDocs() };
  }
  throw new Error(`Projet inconnu : ${key}`);
}

/** Les documents dans l'ordre du temps quand leur contenu le dit, pour que la liste ouverte ait un sens. */
function sortDocs(docs: Corpus["docs"]): Corpus["docs"] {
  const firstDate = (text: string) => text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? "9999";
  return [...docs].sort((a, b) => firstDate(a.text).localeCompare(firstDate(b.text)) || a.file.localeCompare(b.file));
}

/**
 * L'extraction, comme le service la fait : document par document, en donnant à chaque appel la liste
 * ouverte construite sur ce qui a déjà été extrait, puis un seul déclencheur pour le sujet.
 */
async function buildTimeline(corpus: Corpus, outDir: string): Promise<BenchPointer[]> {
  const cache = path.join(outDir, "timeline-v2.json");
  if (fs.existsSync(cache)) {
    const cached = JSON.parse(fs.readFileSync(cache, "utf8")) as BenchPointer[];
    if (cached.every((p) => typeof p.genre === "string" && typeof p.id === "string")) {
      console.log(`  ligne de temps en cache : ${cached.length} pointeurs (${cache})`);
      return cached;
    }
    console.log(`  cache sans genre ignoré : ${cache}`);
  }
  const texts = new Map(corpus.docs.map((d) => [d.file, d.text.split("\n")]));
  // Reprise : l'extraction en cours est écrite après chaque document, pour qu'un run coupé (mémoire,
  // réseau, un document qui échoue) ne refasse pas les appels déjà payés.
  const partial = path.join(outDir, "timeline-v2.partial.json");
  const progress: { done: string[]; all: BenchPointer[] } = fs.existsSync(partial)
    ? (JSON.parse(fs.readFileSync(partial, "utf8")) as { done: string[]; all: BenchPointer[] })
    : { done: [], all: [] };
  const all = progress.all;
  if (progress.done.length > 0) console.log(`  reprise : ${progress.done.length} document(s) déjà extraits, ${all.length} pointeurs`);
  let calls = 0;
  let failed = 0;
  for (const doc of sortDocs(corpus.docs)) {
    if (progress.done.includes(doc.file)) continue;
    const held = new Set(all.map((p) => p.tient).filter((t): t is string => t !== null));
    const rows: GenreEventRow[] = all.map((p) => ({ id: p.id, genre: p.genre, date: p.date, line: p.line, sourceMaterialId: p.file, heldBy: held.has(p.id) }));
    const open = openEventsFor(rows, texts);
    try {
      const { pointers, calls: n } = await extractPointers(doc, open);
      calls += n;
      for (const p of pointers) all.push({ ...p, id: `e${all.length + 1}` });
      console.log(`  ${doc.file} — ${doc.text.length} car., ${n} appel(s), ${open.length} ouvert(s) → ${pointers.length} pointeurs`);
    } catch (err) {
      // Comme le service : un document qui échoue n'empêche pas les autres. Il n'est pas marqué fait,
      // le prochain run le retentera.
      failed += 1;
      console.log(`  !! ${doc.file} — extraction échouée, document sauté : ${String(err).slice(0, 160)}`);
      continue;
    }
    progress.done.push(doc.file);
    fs.writeFileSync(partial, JSON.stringify(progress, null, 2));
  }
  if (failed > 0) console.log(`  ${failed} document(s) non extraits — relancer pour les retenter avant de figer la ligne de temps`);
  const demoted = new Set(keepOldestTrigger(all.map((p, i) => ({ id: p.id, genre: p.genre, date: p.date, createdAt: new Date(i) }))));
  for (const p of all) if (demoted.has(p.id)) p.genre = "livraison";
  all.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.file.localeCompare(b.file) || a.line - b.line);
  if (failed === 0) {
    fs.writeFileSync(cache, JSON.stringify(all, null, 2));
    fs.rmSync(partial, { force: true });
  }
  console.log(`  ${all.length} pointeurs au total, ${calls} appels d'extraction${failed > 0 ? " (ligne de temps NON figée)" : ""}`);
  return all;
}

function genreCounts(pointers: BenchPointer[]): string {
  const counts = new Map<Genre, number>(GENRES.map((g) => [g, 0]));
  for (const p of pointers) counts.set(p.genre, (counts.get(p.genre) ?? 0) + 1);
  const available = pointers.filter((p) => p.disponible).length;
  const holding = pointers.filter((p) => p.tient).length;
  return [...counts.entries()].map(([g, n]) => `${g} ${n}`).join(" · ") + ` · (available) ${available} · (fulfills) ${holding}`;
}

async function run(key: string, postCount: number) {
  const started = Date.now();
  const outDir = path.join(OUT_ROOT, key);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`\n=== ${key} ===`);
  const corpus = await loadCorpus(key);
  console.log(`  ${corpus.docs.length} documents, ${corpus.docs.reduce((n, d) => n + d.text.length, 0)} caractères`);
  console.log(`  cible : ${corpus.readerLabel}`);

  const pointers = await buildTimeline(corpus, outDir);
  const files = new Map(corpus.docs.map((d) => [d.file, d.text.split("\n")]));
  const timeline: TimelineEntry[] = pointers.map((p) => ({
    id: p.id,
    file: p.file,
    line: p.line,
    date: p.date,
    used: false,
    genre: p.genre,
    disponible: p.disponible,
    tient: p.tient,
  }));
  console.log(`  genres : ${genreCounts(pointers)}`);

  const posts: WrittenPost[] = [];
  const runs: Array<{
    n: number;
    form: string | null;
    eventIds: string[];
    genres: string[];
    reads: number;
    postsRead: number;
    formsRead: number;
    refusals: number;
    turns: number;
    seconds: number;
    text: string;
  }> = [];
  const report: string[] = [
    `BANC POINTEURS — ${key}`,
    `modèle : ${process.env.OPENAI_MODEL ?? "(défaut)"}`,
    `${corpus.docs.length} documents, ${pointers.length} pointeurs, ${pointers.filter((p) => p.date).length} datés`,
    `genres : ${genreCounts(pointers)}`,
    `cible : ${corpus.readerLabel} — ${corpus.readerWho}`,
    "",
  ];

  for (let n = 1; n <= postCount; n += 1) {
    const t0 = Date.now();
    const result = await writePost({ ...corpus, timeline, posts, files, platform: "linkedin" });
    const seconds = Math.round((Date.now() - t0) / 1000);
    const reads = result.toolCalls.filter((c) => c.name === "read_file").length;
    const postsRead = result.toolCalls.filter((c) => c.name === "read_post").length;
    const formsRead = result.toolCalls.filter((c) => c.name === "read_form").length;
    const refusals = result.toolCalls.filter((c) => c.name === "publish_post" && typeof c.output === "object" && c.output !== null && "error" in c.output).length;
    const chosen = timeline.filter((e) => result.eventIds.includes(e.id));
    for (const e of chosen) e.used = true;
    posts.push({ id: `p${n}`, date: new Date(Date.UTC(2026, 9, 21 + n)).toISOString().slice(0, 10), text: result.text });
    runs.push({
      n,
      form: result.form,
      eventIds: result.eventIds,
      genres: chosen.map((e) => e.genre),
      reads,
      postsRead,
      formsRead,
      refusals,
      turns: result.turns,
      seconds,
      text: result.text,
    });

    console.log(
      `  post ${n}/${postCount} — ${result.form ?? "PAS DE FORME"} — ${seconds}s, ${result.turns} tours, ${reads} read_file, ${postsRead} read_post, ${formsRead} read_form, ${refusals} refus, ${result.eventIds.length} événement(s)`
    );
    report.push(
      "=".repeat(96),
      `POST ${n} — forme : ${result.form ?? "AUCUNE (publish_post non accepté)"} — ${seconds}s, ${result.turns} tours${result.stoppedAtMaxTurns ? " (PLAFOND DE TOURS ATTEINT)" : ""}`,
      `read_file : ${reads} · read_post : ${postsRead} · read_form : ${formsRead} · publish_post refusés : ${refusals}`,
      `événements choisis : ${
        chosen.length === 0
          ? "AUCUN (publish_post non accepté ou ids inconnus)"
          : chosen.map((e) => `${e.id} ${e.date ?? "no date"} ${e.file}:${e.line} [${e.genre}${e.disponible ? ", available" : ""}${e.tient ? `, fulfills ${e.tient}` : ""}]`).join(" | ")
      }`,
      "=".repeat(96),
      "",
      result.text,
      ""
    );
    // Écrit après chaque post : un banc arrêté en route (mémoire, réseau) garde ce qui est sorti.
    fs.writeFileSync(path.join(outDir, `posts-${process.env.OPENAI_MODEL ?? "modele"}.txt`), report.join("\n"));
  }

  // Relevé machine, pour placer les posts sur la ligne de temps (scripts/carte-ligne-de-temps.mjs).
  fs.writeFileSync(
    path.join(outDir, `run-${process.env.OPENAI_MODEL ?? "modele"}.json`),
    JSON.stringify({ timeline, posts: runs }, null, 2)
  );

  const used = timeline.filter((e) => e.used).length;
  const forms = new Map<string, number>();
  for (const r of runs) forms.set(r.form ?? "aucune", (forms.get(r.form ?? "aucune") ?? 0) + 1);
  report.push(
    "-".repeat(96),
    `${used} pointeurs utilisés sur ${timeline.length}`,
    `formes : ${[...forms.entries()].map(([f, n]) => `${f} ${n}`).join(" · ")}`,
    `durée totale : ${Math.round((Date.now() - started) / 1000)}s`
  );
  const out = path.join(outDir, `posts-${process.env.OPENAI_MODEL ?? "modele"}.txt`);
  fs.writeFileSync(out, report.join("\n"));
  console.log(`  → ${out}`);
}

const args = process.argv.slice(2);
const postCount = Number.isFinite(Number(args[0])) && Number(args[0]) > 0 ? Number(args[0]) : 5;
const keys = args.slice(Number.isFinite(Number(args[0])) ? 1 : 0);
const projects = keys.length > 0 ? keys : ["mytwin", "mykine", "creaflow"];

async function main() {
  for (const key of projects) {
    try {
      await run(key, postCount);
    } catch (err) {
      console.error(`\n!! ${key} : ${String(err)}`);
    }
  }
  process.exit(0);
}

void main();
