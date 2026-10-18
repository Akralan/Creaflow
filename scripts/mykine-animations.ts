/**
 * Écrit, avec le contrôle complet (lecture, essai de rendu dans un navigateur, revue du modèle sur ses images),
 * l'animation de quelques posts du compte de test MyKiné de la base de dev, et la range dans `post_animations` : le
 * compte les montre ensuite dans l'application (docs/SPEC_ANIMATION_HTML_LIBRE.md).
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/mykine-animations.ts [morceau-de-titre ...]
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { scripts, users } from "@/db/schema";
import { buildPlayerDocument } from "@/lib/animationHtml/player";
import { loadPlayerFonts } from "@/lib/animationHtml/fonts";
import { generateAnimationHtml } from "@/lib/llm/animationHtml";
import { animationRequestFor, savePostAnimation } from "@/lib/services/postAnimationService";
import { visualOwnerOf } from "@/lib/services/postVisualService";
import { Bench, DURATION_MS, HEIGHT, WIDTH } from "./animation-bench-lib";

const EMAIL = "mykine.test@example.com";
const DEFAULT_TITLES = ["Le laptop ne suffit pas", "Le serveur ne voit pas la séance", "Le seuil qui triple", "Le premier écart entre téléphones"];
const OUT = path.join(process.cwd(), "docs", "tests", "animation-html", "app");

async function main() {
  const user = await db.query.users.findFirst({ where: eq(users.email, EMAIL), columns: { id: true } });
  if (!user) throw new Error(`No account ${EMAIL} in the dev database.`);
  const wanted = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_TITLES;
  const fonts = await loadPlayerFonts();
  const bench = await Bench.open();
  fs.mkdirSync(OUT, { recursive: true });
  try {
    for (const fragment of wanted) {
      const row = await db.query.scripts.findFirst({ where: and(eq(scripts.userId, user.id), ilike(scripts.title, `%${fragment}%`)) });
      if (!row) {
        console.log(`- no post titled like "${fragment}"`);
        continue;
      }
      const owner = await visualOwnerOf(user.id, row.id);
      console.log(`\n== ${owner.title}`);
      const startedAt = Date.now();
      const request = await animationRequestFor(user.id, owner, DURATION_MS);
      const postText = `${owner.title ?? ""}\n${owner.caption ?? ""}`;
      const result = await generateAnimationHtml(request, {
        retries: 3,
        render: (html) => bench.render(buildPlayerDocument(html, { width: WIDTH, height: HEIGHT, durationMs: DURATION_MS, fonts }), postText),
      });
      await savePostAnimation(user.id, owner.id, DURATION_MS, result);
      const sheet = path.join(OUT, `${(owner.title ?? owner.id).toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48)}.png`);
      await bench.sheet(await bench.render(buildPlayerDocument(result.html, { width: WIDTH, height: HEIGHT, durationMs: DURATION_MS, fonts }), postText), sheet);
      console.log(`ok en ${Math.round((Date.now() - startedAt) / 1000)} s, ${result.attempts} tentative(s)${result.leftover.length ? `, reste : ${result.leftover[0]}` : ""}\n  idée : ${result.concept}`);
    }
  } finally {
    await bench.close();
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
