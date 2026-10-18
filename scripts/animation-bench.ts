/**
 * Banc d'essai de l'animation en HTML libre (docs/SPEC_ANIMATION_HTML_LIBRE.md, lot 0), hors de l'application.
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/animation-bench.ts [nom ...]
 *
 * Pour chaque post d'essai : le modèle écrit l'animation, le contrôle la lit (couche 1), un navigateur la joue dans
 * un iframe enfermé et l'essai de rendu la regarde (couche 3), puis on écrit dans docs/tests/animation-html/<nom>/ :
 * la page jouable (demo.html), la page seule (animation.html), le plan du modèle (concept.json) et une planche
 * d'images (sheet.png).
 */
import fs from "node:fs";
import path from "node:path";
import { generateAnimationHtml, type AnimationRequest } from "@/lib/llm/animationHtml";
import { buildPlayerDocument } from "@/lib/animationHtml/player";
import { loadPlayerFonts } from "@/lib/animationHtml/fonts";
import { designFontNames } from "@/lib/visualDesign/fonts";

import { Bench, demoPage, DURATION_MS, HEIGHT, WIDTH } from "./animation-bench-lib";

const OUT = path.join(process.cwd(), "docs", "tests", "animation-html");

interface Case {
  name: string;
  title: string;
  text: string;
  language: string;
}

// Trois posts du pack MyKiné (docs/tests/mykine-pack/APRES_v4_regeneres_3.txt).
const CASES: Case[] = [
  {
    name: "mykine-1-laptop",
    title: "Le laptop ment par omission",
    language: "French",
    text: `Sur mon laptop, le compteur de squats fonctionnait. Sur l'iPhone 11 de Julien, il ratait une répétition sur trois à 6 fps.

Le prototype était une page web avec MediaPipe Pose en JavaScript. Il comptait un squat quand l'angle hanche-genou-cheville passait sous 100°.

Pour le vérifier, Julien a fait 20 squats dans son salon. Le résultat n'était pas une petite variation de mesure : plusieurs répétitions n'existaient tout simplement pas pour le compteur.

Le modèle de pose pouvait donc fonctionner dans une démo, puis perdre sa valeur dès que le calcul passait sur un téléphone utilisé à la maison.`,
  },
  {
    name: "mykine-2-vps",
    title: "Le VPS était dans le chemin de la caméra",
    language: "French",
    text: `Sur la 4G de Julien, envoyer les frames au serveur ajoutait 300 à 600 ms de latence.

Et je stockais des images de lui en caleçon sur mon VPS.

Le test du 23 novembre a tranché : tout doit tourner sur le téléphone.

Le flux devient : caméra du téléphone → traitement local → compteur de squats. Les frames ne partent plus au serveur pour être traitées. Les images de Julien restent sur son téléphone.`,
  },
  {
    name: "mykine-3-tremblement",
    title: "Trois comptes au fond du squat",
    language: "French",
    text: `L'angle du genou était calculé correctement. Un tremblement faisait pourtant compter un squat trois fois.

L'angle utilise le produit scalaire des vecteurs hanche→genou et cheville→genou. Les seuils : au-dessus de 160° pour la position haute, sous 100° pour la position basse.

Le problème apparaît tout en bas du mouvement. Quand la jambe tremble, l'angle passe trois fois autour de 100°. Chaque passage déclenche le compteur.

La formule donnait le bon angle, mais le nombre de répétitions restait faux. Dans une séance de rééducation, le tableau de bord pourrait afficher trois répétitions alors que le patient n'en a fait qu'une.`,
  },
];

async function main() {
  const wanted = process.argv.slice(2);
  const cases = wanted.length > 0 ? CASES.filter((c) => wanted.some((w) => c.name.includes(w))) : CASES;
  console.log("Fonts…");
  const fonts = await loadPlayerFonts();
  const bench = await Bench.open();
  try {
    for (const c of cases) {
      const t0 = Date.now();
      console.log(`\n== ${c.name}`);
      const req: AnimationRequest = {
        post: { title: c.title, text: c.text, platform: "linkedin" },
        brand: { name: "MyKiné", tone: "direct, concret, sans jargon" },
        width: WIDTH,
        height: HEIGHT,
        durationMs: DURATION_MS,
        fontNames: designFontNames(),
        language: c.language,
      };
      const result = await generateAnimationHtml(req, {
        retries: 3,
        render: async (html) => {
          const outcome = await bench.render(buildPlayerDocument(html, { width: WIDTH, height: HEIGHT, durationMs: DURATION_MS, fonts }), `${c.title}\n${c.text}`);
          // What was refused is kept to look at: the control must be strict, not blind.
          if (outcome.issues.length > 0) {
            const refused = path.join(OUT, "_refused");
            fs.mkdirSync(refused, { recursive: true });
            const stamp = `${c.name}-${Date.now()}`;
            fs.writeFileSync(path.join(refused, `${stamp}.html`), html);
            await bench.sheet(outcome, path.join(refused, `${stamp}.png`));
            fs.writeFileSync(path.join(refused, `${stamp}.txt`), outcome.issues.join("\n"));
          }
          return outcome;
        },
      });
      const doc = buildPlayerDocument(result.html, { width: WIDTH, height: HEIGHT, durationMs: DURATION_MS, fonts });
      const dir = path.join(OUT, c.name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "animation.html"), doc);
      fs.writeFileSync(path.join(dir, "demo.html"), demoPage(doc, c.title));
      fs.writeFileSync(path.join(dir, "concept.json"), JSON.stringify({ concept: result.concept, beats: result.beats, rationale: result.rationale, attempts: result.attempts, reviewed: result.reviewed, leftover: result.leftover, htmlBytes: result.html.length }, null, 2));
      fs.writeFileSync(path.join(dir, "fragment.html"), result.html);
      await bench.sheet(await bench.render(doc, `${c.title}\n${c.text}`), path.join(dir, "sheet.png"));
      console.log(`${c.name}: ok en ${Math.round((Date.now() - t0) / 1000)} s, ${result.attempts} tentative(s), ${Math.round(result.html.length / 1000)} Ko\n  idée : ${result.concept}`);
    }
  } finally {
    await bench.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
