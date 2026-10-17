/**
 * Comparaison V2 / V3 du prompt de génération (docs/SPEC_PROMPT_GENERATION_V3.md §7) — outil de dev,
 * jamais exposé dans l'app.
 *
 * Pour chaque id de script donné, reconstruit son contexte de génération (même sujet, rôle, série,
 * angle, format), génère avec l'ancien prompt (figé dans scripts/compare-v2/, copié de `main` avant
 * la V3) puis avec la V3, et écrit les deux posts côte à côte, plus la préparation et les contrôles
 * de la V3, dans docs/baseline/v2-vs-v3/. N'écrit RIEN en base.
 *
 * Le rédacteur en chef est désactivé par défaut : il peut replanifier (écriture en base) et rendrait
 * les deux versions incomparables (deux choix du jour différents). `--chef` le réactive.
 *
 * Écart connu : la V2 reçoit le bloc FORMAT balisé `<format>` (visualFormat.ts est partagé).
 *
 * `--product=<id>` force le sujet (sa matière et son portrait) pour des scripts qui n'en ont pas.
 *
 * Usage : node_modules/.bin/tsx scripts/compare-generation.ts <scriptId> [<scriptId>…] [--chef] [--product=<id>]
 * (charger .env dans l'environnement avant, ex. `set -a && source .env && set +a` sous bash)
 */
process.env.LLM_PROVIDER = "openai";
if (!process.argv.includes("--chef")) process.env.NARRATIVE_DIRECTOR_ENABLED = "false";

import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { callStructured } from "@/lib/llm/provider";
import { generateScript } from "@/lib/llm/generateScript";
import { buildGenerationContext } from "@/lib/services/scriptService";
import { visualSpecFromScript } from "@/lib/visualDesign/visualFormat";
import { SCRIPT_SYSTEM_PROMPT as V2_SYSTEM, buildScriptUserMessage as buildV2Message } from "./compare-v2/promptsV2";
import { toolForContentType as v2Tool } from "./compare-v2/scriptSchemaV2";

const OUT_DIR = path.join("docs", "baseline", "v2-vs-v3");
const FORCED_PRODUCT_ID = process.argv.find((a) => a.startsWith("--product="))?.slice("--product=".length) ?? null;

function formatPost(post: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push(`**Titre** : ${post.title ?? ""}`);
  if (post.concept) lines.push(`**Concept** : ${post.concept}`);
  if (post.hookText) lines.push(`**Accroche** : ${post.hookText}`);
  if (post.hookVisual) lines.push(`**Accroche visuelle** : ${post.hookVisual}`);
  if (Array.isArray(post.storyboard)) {
    lines.push("**Storyboard** :", ...(post.storyboard as { planNumber: number; description: string }[]).map((s) => `${s.planNumber}. ${s.description}`));
  }
  lines.push("", "**Texte** :", "", String(post.caption ?? ""), "");
  lines.push(`**Hashtags** : ${((post.hashtags as string[]) ?? []).join(" ") || "(aucun)"}`);
  lines.push(`**Longueur du texte** : ${String(post.caption ?? "").length} caractères`);
  return lines.join("\n");
}

async function compare(scriptId: string): Promise<string> {
  const script = await db.query.scripts.findFirst({ where: eq(scripts.id, scriptId) });
  if (!script) throw new Error(`Script introuvable : ${scriptId}`);
  const contentType = script.contentType as "visual" | "text";
  const context = await buildGenerationContext(
    script.userId,
    script.platform,
    script.contentCategoryId,
    contentType,
    FORCED_PRODUCT_ID ?? script.productId,
    script.id,
    script.seriesId,
    script.angleId,
    undefined,
    undefined,
    visualSpecFromScript(script)
  );

  const started = Date.now();
  const v2 = (await callStructured({
    system: V2_SYSTEM,
    userMessage: buildV2Message(context),
    tool: v2Tool(contentType),
    maxTokens: 2048,
    strict: true,
  })) as Record<string, unknown>;
  const v2Ms = Date.now() - started;

  const startedV3 = Date.now();
  const v3 = await generateScript(context);
  const v3Ms = Date.now() - startedV3;

  const trace = v3.trace;
  const sections = [
    `# ${script.title ?? scriptId} — ${script.platform} · ${contentType}`,
    `Script d'origine : \`${scriptId}\` · lecteurs du sujet : ${context.readers?.map((r) => r.label).join(", ") || "aucun portrait"}`,
    "",
    `## V2 (${v2Ms} ms)`,
    "",
    formatPost(v2),
    "",
    `## V3 (${v3Ms} ms${trace?.checks.retried ? ", seconde tentative" : ""})`,
    "",
    formatPost(v3 as unknown as Record<string, unknown>),
    "",
    "### Préparation V3",
    "",
    trace
      ? [
          `- **Lecteur** : ${trace.reader.label} — sait : ${trace.reader.knows} — veut : ${trace.reader.wants}`,
          `- **Moments candidats** :`,
          ...trace.candidateMoments.map((m, i) => `  ${i === trace.chosenMoment.index ? "→" : "-"} ${m.moment}${m.excerpt ? ` (« ${m.excerpt} »)` : ""}`),
          `- **Pourquoi ce moment** : ${trace.chosenMoment.why}`,
          `- **Accroches candidates** :`,
          ...trace.hookOptions.map((h, i) => `  ${i === trace.chosenHook.index ? "→" : "-"} [${h.kind}] ${h.text}`),
          `- **Pourquoi cette accroche** : ${trace.chosenHook.why}`,
          `- **Relecture** : faits sourcés ${trace.selfCheck.factsFromMaterial ? "oui" : "NON"} · test auteur ${trace.selfCheck.authorTest ? "oui" : "NON"} · lecteur : ${trace.selfCheck.readerTest}`,
          `- **Contrôles restants** : ${trace.checks.failures.length ? trace.checks.failures.join(" / ") : "aucun"}`,
        ].join("\n")
      : "(pas de préparation renvoyée)",
  ];
  return sections.join("\n");
}

async function main() {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (ids.length === 0) {
    console.error("Usage : tsx scripts/compare-generation.ts <scriptId> [<scriptId>…] [--chef]");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const id of ids) {
    try {
      const report = await compare(id);
      fs.writeFileSync(path.join(OUT_DIR, `${id}.md`), report + "\n", "utf-8");
      console.log(`ok ${id}`);
    } catch (err) {
      const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
      fs.writeFileSync(path.join(OUT_DIR, `${id}.ERROR.txt`), message, "utf-8");
      console.error(`échec ${id} : ${message.split("\n")[0]}`);
    }
  }
  process.exit(0);
}

main();
