/**
 * Lot 2 (docs/SPEC_PROMPT_GENERATION_TECH.md §7) — "après" concept & schémas.
 *
 * Rejoue EXACTEMENT les 5 mêmes briefs que scripts/baseline-lot0-run.ts et baseline-lot1-run.ts
 * (mêmes ids en base, même ordre), avec le prompt mis à jour par le Lot 2 (§4 : champ "concept" en
 * première propriété, `required`, sur les 3 tools de génération ; descriptions de champs
 * qualitatives, Annexe A.5 ; SCRIPT_SYSTEM_PROMPT réconcilié avec le texte exact de l'Annexe A.2
 * maintenant que le champ existe) — toujours forcé sur OpenAI. Migration DB appliquée
 * (Script.concept/rejectedConcepts) ; l'audience (Lot 4) n'existe toujours pas.
 *
 * N'écrit RIEN en base, même mécanique que les runs Lot 0/Lot 1.
 *
 * Usage : node_modules/.bin/tsx scripts/baseline-lot2-run.ts
 * (charger .env dans l'environnement avant, ex. `set -a && source .env && set +a` sous bash)
 */
process.env.LLM_PROVIDER = "openai";

import fs from "node:fs";
import path from "node:path";
import { buildGenerationContext } from "@/lib/services/scriptService";
import { generateScript } from "@/lib/llm/generateScript";
import { SCRIPT_SYSTEM_PROMPT, buildScriptUserMessage } from "@/lib/llm/prompts";
import type { ContentType, Platform } from "@/lib/llm/prompts";

const USER_ID = "f4d25311-2cea-439d-abac-6e27501d3f2b"; // MarvelousDev — seul profil en base

interface Brief {
  slug: string;
  note: string;
  platform: Platform;
  contentType: ContentType;
  contentCategoryId: string;
  productId: string | null;
  seriesId: string | null;
}

// Identiques à scripts/baseline-lot0-run.ts — ne pas modifier sans mettre à jour les deux fichiers.
const BRIEFS: Brief[] = [
  {
    slug: "01-rich-video-serie",
    note: "Matière riche (23 docs, MyTwin Leaderboard) · vidéo TikTok · série imposée (Coulisses du Vendredi)",
    platform: "tiktok",
    contentType: "video",
    contentCategoryId: "8fe7a710-2f88-42ad-aa72-e637ab845b4e", // Coulisses
    productId: "ee94584a-708c-4de6-987e-7e30b8ab538d", // MyTwin Leaderboard
    seriesId: "9b913624-4ae0-4c07-a928-945f44d8f0fd", // Coulisses du Vendredi
  },
  {
    slug: "02-medium-text-sans-serie",
    note: "Matière moyenne (6 docs, PPO HotlineMiami) · texte LinkedIn · pas de série",
    platform: "linkedin",
    contentType: "text",
    contentCategoryId: "1ac4862f-9b1d-47a9-8e8d-b35bb6a80794", // Tips Tech
    productId: "ed1de0ac-2e20-44db-b45b-90aa3a201fb5", // PPO HotlineMiami
    seriesId: null,
  },
  {
    slug: "03-sparse-visual-serie",
    note: "Matière rare (4 docs, PixelPitch) · visuel Instagram · série imposée (Showcase du Lundi)",
    platform: "instagram",
    contentType: "visual",
    contentCategoryId: "64093d8b-b070-4833-9074-fcad6df25c5b", // Showcase Prod
    productId: "66701c4f-57d8-431a-b4e3-c66900cef13e", // PixelPitch
    seriesId: "52743b2a-1304-4d90-8832-c2623c2d0da7", // Showcase du Lundi
  },
  {
    slug: "04-sans-matiere-sans-produit",
    note: "Aucun produit, aucune matière (niveau marque, 0 doc) · texte X · pas de série — teste les garde-fous anti-invention",
    platform: "x",
    contentType: "text",
    contentCategoryId: "0eb95cff-5382-46e0-9d7c-abe4a0adbab9", // Actu & Trends
    productId: null,
    seriesId: null,
  },
  {
    slug: "05-rich-video-autre-format-sans-serie",
    note: "Même matière riche que le brief 1 (MyTwin Leaderboard) mais YouTube, pas de série — compare le rendu du même corpus sur un autre format",
    platform: "youtube",
    contentType: "video",
    contentCategoryId: "8fe7a710-2f88-42ad-aa72-e637ab845b4e", // Coulisses
    productId: "ee94584a-708c-4de6-987e-7e30b8ab538d", // MyTwin Leaderboard
    seriesId: null,
  },
];

const OUT_DIR = path.join(process.cwd(), "docs", "baseline", "lot2-openai");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "_system-prompt.txt"), SCRIPT_SYSTEM_PROMPT, "utf-8");

  const summary: string[] = [
    "# Baseline Lot 2 — sorties brutes (après §4 : champ concept + descriptions qualitatives)",
    "",
    `Provider forcé : OpenAI (\`${process.env.OPENAI_MODEL || "gpt-5-mini"}\`). Généré le ${new Date().toISOString()}.`,
    "",
    "Mêmes 5 briefs, mêmes ids en base, que docs/baseline/lot0-openai/ — seul le prompt a changé.",
    "",
    "Aucune écriture en base — uniquement des appels LLM en lecture de contexte.",
    "",
  ];

  for (const brief of BRIEFS) {
    console.log(`\n--- ${brief.slug} ---`);
    console.log(brief.note);

    try {
      const context = await buildGenerationContext(
        USER_ID,
        brief.platform,
        brief.contentCategoryId,
        brief.contentType,
        brief.productId,
        null,
        brief.seriesId
      );
      const userMessage = buildScriptUserMessage(context);
      const generated = await generateScript(context);

      const fileContent = [
        `# Brief ${brief.slug}`,
        "",
        `> ${brief.note}`,
        "",
        `- Plateforme : ${brief.platform}`,
        `- Type de contenu : ${brief.contentType}`,
        `- Catégorie : ${context.contentCategory.label} (${brief.contentCategoryId})`,
        `- Produit : ${context.product?.name ?? "(aucun)"}`,
        `- Série : ${context.series?.label ?? "(aucune)"}`,
        `- Angle imposé : ${context.angle?.label ?? "(aucun)"}`,
        `- Documents de matière injectés : ${context.materialDocuments?.length ?? 0}`,
        "",
        "## Message utilisateur assemblé (envoyé au LLM)",
        "",
        "```",
        userMessage,
        "```",
        "",
        "## Sortie brute générée (OpenAI)",
        "",
        "```json",
        JSON.stringify(generated, null, 2),
        "```",
        "",
      ].join("\n");

      fs.writeFileSync(path.join(OUT_DIR, `${brief.slug}.md`), fileContent, "utf-8");
      summary.push(`- [\`${brief.slug}\`](./${brief.slug}.md) — ${brief.note} → **OK**`);
      console.log("OK");
    } catch (err) {
      const message = err instanceof Error ? err.stack || err.message : String(err);
      fs.writeFileSync(path.join(OUT_DIR, `${brief.slug}.ERROR.txt`), message, "utf-8");
      summary.push(`- \`${brief.slug}\` — ${brief.note} → **ÉCHEC** (voir \`${brief.slug}.ERROR.txt\`)`);
      console.error("ÉCHEC :", message);
    }
  }

  fs.writeFileSync(path.join(OUT_DIR, "README.md"), summary.join("\n") + "\n", "utf-8");
  console.log(`\nRésultats écrits dans ${OUT_DIR}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
