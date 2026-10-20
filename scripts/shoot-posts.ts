/**
 * Prend en photo les posts d'un compte, tels qu'ils s'affichent dans l'app. Pour regarder le
 * résultat d'une génération sans avoir à cliquer, et pour pouvoir le montrer.
 *
 * Refuse toute base non locale, comme `seed-mykine.ts` : il se connecte avec un mot de passe.
 *
 * Usage :
 *   node_modules/.bin/tsx scripts/shoot-posts.ts <email> <mot-de-passe> [dossier-de-sortie]
 */
import fs from "node:fs";
import path from "node:path";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { chromium } from "playwright-core";
import { db } from "@/db";
import { calendarEntries, users } from "@/db/schema";

const APP = process.env.APP_URL || "http://localhost:3000";

function refuseUnlessLocalDev() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante.");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "postgres", "db"].includes(host)) {
    throw new Error(`La base pointe sur « ${host} » : ce script de capture ne tourne qu'en local.`);
  }
}

async function main() {
  refuseUnlessLocalDev();
  const [email, password, outDir = "docs/tests/captures"] = process.argv.slice(2);
  if (!email || !password) throw new Error("Donne un email et un mot de passe.");

  const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
  if (!user) throw new Error(`Compte introuvable : ${email}`);

  // Les posts dans l'ordre du calendrier, version LinkedIn : c'est celle qu'on lit.
  const slots = await db.query.calendarEntries.findMany({
    where: and(eq(calendarEntries.userId, user.id), isNotNull(calendarEntries.scriptId), eq(calendarEntries.platform, "linkedin")),
    orderBy: asc(calendarEntries.scheduledDate),
    columns: { scriptId: true, scheduledDate: true, kind: true, narrativeKind: true },
    with: { script: { columns: { caption: true } } },
  });
  if (slots.length === 0) throw new Error("Aucun post écrit sur ce compte.");

  fs.mkdirSync(outDir, { recursive: true });
    // Le binaire déjà installé sur la machine : on ne télécharge rien (la révision attendue par
  // playwright-core peut différer de celle présente, PLAYWRIGHT_CHROME laisse le choix).
  const executablePath = process.env.PLAYWRIGHT_CHROME || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 2 });

  // Connexion par l'API : le formulaire dépend du rendu client, l'API non — et le cookie de
  // session se pose dans le contexte du navigateur, donc les pages suivantes sont authentifiées.
  const login = await page.request.post(`${APP}/api/auth/login`, { data: { email, password } });
  if (!login.ok()) throw new Error(`Connexion refusée (${login.status()}) : ${(await login.text()).slice(0, 200)}`);
  const written: string[] = [];
  for (const [i, slot] of slots.entries()) {
    const day = slot.scheduledDate.toISOString().slice(0, 10);
    const kind = slot.kind === "narrative" ? `recit-${slot.narrativeKind}` : "episode";
    const file = path.join(outDir, `post-${i + 1}-${day}-${kind}.png`);
    await page.goto(`${APP}/scripts/${slot.scriptId}`, { waitUntil: "domcontentloaded" });
    // On attend le TEXTE du post, pas un délai : en dev, Next compile la page à la première visite
    // et une capture prise trop tôt ne montre qu'un écran vide marqué « Compiling ».
    const needle = (slot.script?.caption ?? "").trim().slice(0, 40);
    if (needle) await page.getByText(needle, { exact: false }).first().waitFor({ timeout: 120_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file, fullPage: true });
    written.push(file);
    console.log(`${file}  (${day}, ${kind})`);
  }

  await browser.close();
  console.log(`\n${written.length} capture(s) dans ${outDir}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✖", err);
  process.exit(1);
});
