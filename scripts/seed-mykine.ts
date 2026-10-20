/**
 * Monte un compte de démonstration à partir du pack MyKiné (`docs/tests/mykine-pack/`) en passant par
 * les VRAIS services de l'app — rien n'est truqué : le lecteur d'événements lit la matière, le portrait
 * des lecteurs est écrit, la série reçoit son lecteur et sa forme, le calendrier se remplit, et les
 * posts sont écrits par les rédacteurs (23 pour un épisode, 28 pour un post de récit).
 *
 * Demande `OPENAI_API_KEY` et `LLM_PROVIDER=openai` dans `.env`, plus la base de dev lancée.
 * Compte quelques minutes : la lecture de la matière est longue, et chaque post coûte 3 à 6 appels.
 *
 * Refuse de tourner ailleurs que sur une base locale : il affiche un mot de passe en clair.
 *
 * Usage :
 *   set -a && source .env && set +a && node_modules/.bin/tsx scripts/seed-mykine.ts [nombre-de-posts]
 *
 * Idempotent : relancé, il garde le compte, la matière et les posts déjà écrits, et complète le reste.
 * Pour repartir de zéro : `node_modules/.bin/tsx scripts/seed-mykine.ts --reset`.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/db";
import { calendarEntries, contentSeries, creatorProfiles, products, sourceMaterials, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { readEventsForSubject, listEventsForSubject } from "@/lib/services/materialEventService";
import { refreshStaleReaderPortraits } from "@/lib/services/readerPortraitService";
import { generateCategoriesForUser, listActiveCategoriesForUser } from "@/lib/services/categoryLabelsService";
import { generateAnglesForUser, listActiveAnglesForUser } from "@/lib/services/angleService";
import { generateSeriesForUser, listActiveSeriesForUser } from "@/lib/services/seriesService";
import { ensureReaderForSeries } from "@/lib/services/seriesReaderService";
import { syncSeriesSlots } from "@/lib/services/seriesSlotSync";
import { writePost } from "@/lib/services/postPairService";

const EMAIL = "mykine.demo@example.com";
const PACK = path.join(process.cwd(), "docs", "tests", "mykine-pack");

/**
 * Ce script crée un compte avec un mot de passe qu'il affiche : il ne doit JAMAIS toucher autre chose
 * qu'une base de développement locale. Le garde-fou est ici, avant toute écriture, parce que
 * `source .env` sur la mauvaise machine suffirait sinon à planter un compte connu en production.
 */
function refuseUnlessLocalDev() {
  if (process.env.NODE_ENV === "production") throw new Error("NODE_ENV=production : ce script de démonstration ne tourne pas en production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante.");
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("DATABASE_URL illisible.");
  }
  const local = ["localhost", "127.0.0.1", "::1", "postgres", "db"];
  if (!local.includes(host)) {
    throw new Error(`La base pointe sur « ${host} », qui n'est pas une base locale. Ce script crée un compte avec un mot de passe affiché en clair : il refuse toute autre base.`);
  }
}

/** Un mot de passe par exécution, jamais une constante dans le dépôt. */
function freshPassword(): string {
  return `demo-${randomBytes(9).toString("base64url")}`;
}

const SUBJECT = {
  name: "MyKiné",
  description:
    "Le kiné prescrit un programme d'exercices ; le patient les fait chez lui devant la caméra de son téléphone ; l'app compte les répétitions, vérifie l'amplitude et l'alignement en direct, et envoie un compte-rendu de séance au kiné.",
  problem: "Environ 6 patients sur 10 ne font pas leurs exercices à la maison, et le kiné n'a aucun moyen de le savoir.",
  valueProposition: "Le kiné voit enfin ce qui se passe entre deux séances, sans que le patient ait à se filmer pour lui.",
  // Volontairement étroit : des kinés libéraux du sport, et personne d'autre. Élargir ce champ aux
  // développeurs change tout le reste — le portrait des lecteurs en tire des publics techniques, et
  // les posts partent vers la stack au lieu du cabinet.
  targetAudience:
    "Des kinés libéraux du sport, en cabinet, qui suivent des patients en rééducation entre deux séances. Pas des développeurs : ils ne veulent rien savoir de la technique, seulement ce que ça change pour leurs patients et pour leur temps.",
};

function log(step: string) {
  console.log(`\n▶ ${step}`);
}

/** Les documents du pack : la couche A (doc technique) et la couche B (devlog daté, décisions). */
function packDocuments(): Array<{ title: string; text: string }> {
  const docs: Array<{ title: string; text: string }> = [];
  for (const layer of ["A", "B"]) {
    const dir = path.join(PACK, layer);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      docs.push({ title: `${layer}/${file}`, text: fs.readFileSync(path.join(dir, file), "utf-8") });
    }
  }
  if (docs.length === 0) throw new Error(`Aucun document dans ${PACK}/A et ${PACK}/B.`);
  return docs;
}

async function reset() {
  refuseUnlessLocalDev();
  const user = await db.query.users.findFirst({ where: eq(users.email, EMAIL), columns: { id: true } });
  if (!user) return console.log("Rien à supprimer.");
  await db.delete(users).where(eq(users.id, user.id)); // CASCADE sur tout le reste
  console.log(`Compte ${EMAIL} supprimé.`);
}

async function main() {
  if (process.argv.includes("--reset")) {
    await reset();
    process.exit(0);
  }
  refuseUnlessLocalDev();
  const wanted = Number(process.argv[2]) || 3;
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante : tout le pipeline passe par OpenAI.");
  if (process.env.LLM_PROVIDER !== "openai") throw new Error("Mettre LLM_PROVIDER=openai dans .env (le repli codé en dur, gemini, n'est pas opérationnel).");

  log("Compte et profil");
  // Un mot de passe neuf à chaque exécution, y compris sur un compte déjà là : sinon celui qu'on
  // affiche à la fin serait faux au second passage.
  const password = freshPassword();
  let user = await db.query.users.findFirst({ where: eq(users.email, EMAIL) });
  if (!user) {
    [user] = await db.insert(users).values({ email: EMAIL, passwordHash: await hashPassword(password) }).returning();
    console.log(`  compte créé : ${EMAIL}`);
  } else {
    await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
    console.log(`  compte déjà là : ${EMAIL} (mot de passe renouvelé)`);
  }
  const userId = user.id;

  if (!(await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) }))) {
    await db.insert(creatorProfiles).values({
      userId,
      brandName: "Alix",
      activityType: "Développeuse solo, application de kinésithérapie",
      expectations: "Raconter la construction de MyKiné sans y passer mes soirées.",
      language: "fr",
      publishingDays: [3, 5, 6],
      targetAudience: SUBJECT.targetAudience,
    });
    console.log("  profil créé");
  }

  log("Sujet");
  let product = await db.query.products.findFirst({ where: and(eq(products.userId, userId), eq(products.name, SUBJECT.name)) });
  if (!product) {
    [product] = await db
      .insert(products)
      .values({ userId, name: SUBJECT.name, description: SUBJECT.description, problem: SUBJECT.problem, valueProposition: SUBJECT.valueProposition, targetAudience: SUBJECT.targetAudience })
      .returning();
    console.log(`  sujet créé : ${SUBJECT.name}`);
  }
  const productId = product.id;

  log("Matière (documents du pack, collés comme des notes)");
  const existing = await db.query.sourceMaterials.findMany({ where: and(eq(sourceMaterials.userId, userId), eq(sourceMaterials.productId, productId)), columns: { title: true } });
  const already = new Set(existing.map((d) => d.title));
  const toInsert = packDocuments().filter((d) => !already.has(d.title));
  if (toInsert.length > 0) {
    await db.insert(sourceMaterials).values(toInsert.map((d) => ({ userId, productId, kind: "paste" as const, title: d.title, rawText: d.text })));
  }
  console.log(`  ${already.size + toInsert.length} document(s), dont ${toInsert.length} nouveau(x)`);

  log("Portrait des lecteurs (appel modèle)");
  await refreshStaleReaderPortraits(userId, [productId]);
  const portrait = (await db.query.products.findFirst({ where: eq(products.id, productId), columns: { readerPortrait: true } }))?.readerPortrait;
  console.log(`  ${Array.isArray((portrait as { readers?: unknown[] })?.readers) ? (portrait as { readers: unknown[] }).readers.length : 0} lecteur(s)`);

  log("Lecture de la matière : la ligne de temps (agent, plusieurs minutes)");
  const report = await readEventsForSubject(userId, productId);
  console.log(`  ${report.documentsRead}/${report.documents} document(s) lus, ${report.eventsSaved} événement(s) enregistré(s), ${report.eventsRejected} refusé(s)`);
  const events = await listEventsForSubject(userId, productId);
  console.log(`  ligne de temps : ${events.length} événement(s), du ${events[0]?.date ?? "?"} au ${events[events.length - 1]?.date ?? "?"}`);
  if (events.length === 0) throw new Error("Ligne de temps vide : rien à raconter, inutile d'aller plus loin.");

  log("Direction éditoriale : rôles, angles, séries");
  if ((await listActiveCategoriesForUser(userId)).length === 0) await generateCategoriesForUser(userId);
  if ((await listActiveAnglesForUser(userId)).length === 0) await generateAnglesForUser(userId);
  if ((await listActiveSeriesForUser(userId)).length === 0) await generateSeriesForUser(userId, { leadWithDevlog: true });
  const series = await listActiveSeriesForUser(userId);
  const devlog = series[0];
  if (!devlog) throw new Error("Aucune série n'a pu être créée.");
  console.log(`  ${series.length} série(s), devlog : « ${devlog.label} »`);

  log("Rythme et calendrier");
  await db.update(contentSeries).set({ rhythm: { days: [3, 5, 6], every: 1, anchor: null } }).where(eq(contentSeries.id, devlog.id));
  for (const other of series.slice(1)) await db.update(contentSeries).set({ rhythm: null }).where(eq(contentSeries.id, other.id));
  await syncSeriesSlots(userId);
  await ensureReaderForSeries(userId, devlog.id);
  const withReader = await db.query.contentSeries.findFirst({ where: eq(contentSeries.id, devlog.id), columns: { readerLabel: true } });
  console.log(`  lecteur de la série : ${withReader?.readerLabel ?? "(aucun)"}`);

  log(`Écriture des ${wanted} premiers posts (le fil narratif décide de chaque type)`);
  const today = new Date();
  const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  for (let i = 0; i < wanted; i += 1) {
    const [slot] = await db.query.calendarEntries.findMany({
      where: and(eq(calendarEntries.userId, userId), eq(calendarEntries.seriesId, devlog.id), gte(calendarEntries.scheduledDate, from), isNull(calendarEntries.scriptId)),
      orderBy: asc(calendarEntries.scheduledDate),
      limit: 1,
    });
    if (!slot) {
      console.log("  plus de créneau libre dans les 28 jours.");
      break;
    }
    await writePost(userId, slot);
    const written = await db.query.calendarEntries.findFirst({ where: eq(calendarEntries.id, slot.id), columns: { kind: true, narrativeKind: true, scheduledDate: true } });
    console.log(`  post ${i + 1} — ${written?.scheduledDate.toISOString().slice(0, 10)} — ${written?.kind === "narrative" ? `POST DE RÉCIT (${written.narrativeKind})` : "épisode"}`);
  }

  log("Fini");
  console.log(`  Connexion : http://localhost:3000/login`);
  console.log(`  ${EMAIL}`);
  console.log(`  ${password}   (valable jusqu'à la prochaine exécution de ce script)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✖", err);
  process.exit(1);
});
