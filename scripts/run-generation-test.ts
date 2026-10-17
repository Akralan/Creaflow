/**
 * Banc d'essai de la génération (outil de dev, jamais exposé dans l'app).
 *
 * Deux modes, chacun écrit un fichier JSON lu par scripts/build-test-report.ts :
 * - `--baseline` : relève les scripts tels qu'ils sont en base (texte, format, maquette) ;
 * - sinon : les RÉGÉNÈRE avec le code actuel et la même matière (même sujet, rôle, série, angle,
 *   épisode, format, mêmes photos pour la maquette). Rien n'est écrit : ni script, ni maquette, ni
 *   citation ; l'état du rédacteur en chef est sauvegardé avant et restauré s'il a bougé. Seule
 *   exception : la veille d'inspiration du sujet, relancée si elle a plus de 7 jours, comme en usage.
 *
 * `--v2` régénère avec l'ANCIEN prompt (figé dans scripts/compare-v2/), même contexte : la colonne
 * qui permet de séparer l'effet du prompt de celui de la matière.
 *
 * Usage : node_modules/.bin/tsx scripts/run-generation-test.ts <sortie.json> [--baseline|--v2] [--product=<id>] <scriptId>…
 * (charger .env avant, ex. `set -a && source .env && set +a`)
 */
process.env.LLM_PROVIDER = process.env.LLM_PROVIDER || "openai";

import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  brandAssets,
  contentAngles,
  contentCategories,
  contentSeries,
  creatorProfiles,
  narrativeState,
  scripts,
  visualDesigns,
} from "@/db/schema";
import { generateScript } from "@/lib/llm/generateScript";
import { callStructured } from "@/lib/llm/provider";
import { SCRIPT_SYSTEM_PROMPT as V2_SYSTEM, buildScriptUserMessage as buildV2Message } from "./compare-v2/promptsV2";
import { toolForContentType as v2Tool } from "./compare-v2/scriptSchemaV2";
import type { GeneratedScript } from "@/lib/llm/scriptSchema";
import { buildGenerationContext } from "@/lib/services/scriptService";
import { previewDesign } from "@/lib/services/visualDesignService";
import { refreshInspirationsIfStale } from "@/lib/services/inspirationService";
import {
  parseStoredDesignImages,
  type DesignImage,
} from "@/lib/visualDesign/designImages";
import { parseStoredBrandKit } from "@/lib/visualDesign/brandKit";
import { visualSpecFromScript } from "@/lib/visualDesign/visualFormat";
import { getObjectStorage, isObjectStorageConfigured } from "@/lib/storage";

const args = process.argv.slice(2);
const OUT = args[0];
const BASELINE = args.includes("--baseline");
const FORCED_PRODUCT_ID =
  args.find((a) => a.startsWith("--product="))?.slice("--product=".length) ??
  null;
const IDS = args.slice(1).filter((a) => !a.startsWith("--"));
const V2 = args.includes("--v2");

/** Ancien prompt, même contexte (scripts/compare-v2/) — sans préparation ni contrôles. */
async function generateV2(context: Parameters<typeof generateScript>[0]): Promise<GeneratedScript> {
  const args = (await callStructured({
    system: V2_SYSTEM,
    userMessage: buildV2Message(context),
    tool: v2Tool(context.contentType),
    maxTokens: 2048,
    strict: true,
  })) as Record<string, unknown>;
  return { contentType: context.contentType, usedExcerpts: [], promisesMade: [], ...args } as unknown as GeneratedScript;
}

interface Entry {
  scriptId: string;
  platform: string;
  contentType: string;
  visualFormat: string | null;
  durationMs: number | null;
  context: Record<string, unknown>;
  post: Record<string, unknown>;
  design: null | {
    width: number;
    height: number;
    durationMs: number | null;
    slides: { planNumber: number; html: string }[];
    timeline: unknown;
    imageUrls: Record<string, string>;
    logoUrl: string | null;
    rationale?: string;
  };
  trace: unknown;
  error?: string;
  /** La maquette a échoué mais le texte du post est gardé. */
  designError?: string;
  ms?: number;
}

function publicUrl(key: string | null | undefined): string | null {
  return key && isObjectStorageConfigured()
    ? getObjectStorage().getPublicUrl(key)
    : null;
}

async function imageUrls(
  userId: string,
  images: DesignImage[],
): Promise<Record<string, string>> {
  if (images.length === 0) return {};
  const rows = await db.query.brandAssets.findMany({
    where: and(
      eq(brandAssets.userId, userId),
      inArray(
        brandAssets.id,
        images.map((i) => i.assetId),
      ),
    ),
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: Record<string, string> = {};
  for (const img of images) {
    const asset = byId.get(img.assetId);
    const url = publicUrl(
      img.variant === "cutout"
        ? (asset?.cutoutKey ?? asset?.originalKey)
        : asset?.originalKey,
    );
    if (url) out[img.ref] = url;
  }
  return out;
}

async function logoUrl(userId: string): Promise<string | null> {
  const profile = await db.query.creatorProfiles.findFirst({
    where: eq(creatorProfiles.userId, userId),
  });
  const logoId = parseStoredBrandKit(profile?.brandKit)?.logoAssetId;
  if (!logoId) return null;
  const asset = await db.query.brandAssets.findFirst({
    where: eq(brandAssets.id, logoId),
  });
  return publicUrl(asset?.originalKey);
}

async function labels(script: typeof scripts.$inferSelect) {
  const [series, category, angle] = await Promise.all([
    script.seriesId
      ? db.query.contentSeries.findFirst({
          where: eq(contentSeries.id, script.seriesId),
        })
      : null,
    db.query.contentCategories.findFirst({
      where: eq(contentCategories.id, script.contentCategoryId),
    }),
    script.angleId
      ? db.query.contentAngles.findFirst({
          where: eq(contentAngles.id, script.angleId),
        })
      : null,
  ]);
  return {
    series: series?.label ?? null,
    role: category?.label ?? null,
    angle: angle?.label ?? null,
    beatId: script.beatId,
  };
}

async function baseline(script: typeof scripts.$inferSelect): Promise<Entry> {
  const design = await db.query.visualDesigns.findFirst({
    where: eq(visualDesigns.scriptId, script.id),
  });
  const images = design ? parseStoredDesignImages(design.images) : [];
  return {
    scriptId: script.id,
    platform: script.platform,
    contentType: script.contentType,
    visualFormat: script.contentType === "visual" ? script.visualFormat : null,
    durationMs: script.durationMs,
    context: await labels(script),
    post: {
      title: script.title,
      concept: script.concept,
      hookText: script.hookText,
      hookVisual: script.hookVisual,
      storyboard: script.storyboard,
      caption: script.caption,
      hashtags: script.hashtags,
    },
    design: design
      ? {
          width: design.width,
          height: design.height,
          durationMs: design.durationMs,
          slides: (design.slides as { planNumber: number; html: string }[]).map(
            (s) => ({ planNumber: s.planNumber, html: s.html }),
          ),
          timeline: design.timeline,
          imageUrls: await imageUrls(script.userId, images),
          logoUrl: await logoUrl(script.userId),
        }
      : null,
    trace: script.generationTrace,
  };
}

async function regenerate(script: typeof scripts.$inferSelect): Promise<Entry> {
  const started = Date.now();
  const contentType = script.contentType as "visual" | "text";
  const visual = visualSpecFromScript(script);
  // Comme en usage réel : la veille d'inspiration du sujet est relancée si elle n'est pas fraîche.
  await refreshInspirationsIfStale(
    script.userId,
    FORCED_PRODUCT_ID ?? script.productId,
  );
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
    visual,
  );
  const generated = V2 ? await generateV2(context) : await generateScript(context);
  const original = await db.query.visualDesigns.findFirst({
    where: eq(visualDesigns.scriptId, script.id),
  });
  let design: Entry["design"] = null;
  let designError: string | undefined;
  if (generated.contentType === "visual" && original) {
    try {
      const images = parseStoredDesignImages(original.images);
      const result = await previewDesign(script.userId, {
        platform: script.platform,
        title: generated.title,
        hookVisual: generated.hookVisual,
        storyboard: generated.storyboard,
        width: original.width,
        height: original.height,
        animationDurationMs: original.durationMs,
        images,
      });
      const variants = new Map(result.images.map((i) => [i.ref, i.variant]));
      design = {
        width: original.width,
        height: original.height,
        durationMs: original.durationMs,
        slides: result.slides,
        timeline: result.timeline,
        imageUrls: await imageUrls(
          script.userId,
          images.map((i) => ({
            ...i,
            variant: variants.get(i.ref) ?? "original",
          })),
        ),
        logoUrl: await logoUrl(script.userId),
        rationale: result.rationale,
      };
    } catch (err) {
      designError = err instanceof Error ? err.message : String(err);
    }
  }
  const { trace, ...post } = generated;
  return {
    scriptId: script.id,
    platform: script.platform,
    contentType,
    visualFormat: visual?.format ?? null,
    durationMs: visual?.durationMs ?? null,
    context: {
      ...(await labels(script)),
      episode: context.direction?.beatTitle ?? null,
      direction: context.direction?.concept ?? null,
      readers: context.readers?.map((r) => r.label) ?? [],
      recentPosts: context.recentPosts?.length ?? 0,
      inspirations: context.inspirations?.length ?? 0,
      materialDocuments: context.materialDocuments?.length ?? 0,
    },
    post,
    design,
    trace: trace ?? null,
    designError,
    ms: Date.now() - started,
  };
}

async function main() {
  if (!OUT || IDS.length === 0) {
    console.error(
      "Usage : tsx scripts/run-generation-test.ts <sortie.json> [--baseline] [--product=<id>] <scriptId>…",
    );
    process.exit(1);
  }
  const rows = await db.query.scripts.findMany({
    where: inArray(scripts.id, IDS),
  });
  const ordered = IDS.map((id) => rows.find((r) => r.id === id)).filter(
    (r): r is typeof scripts.$inferSelect => Boolean(r),
  );
  const userIds = [...new Set(ordered.map((r) => r.userId))];
  // Le choix du jour peut replanifier un arc (écriture en base) : on garde l'état pour le remettre.
  const savedStates = BASELINE
    ? []
    : await db.query.narrativeState.findMany({
        where: inArray(narrativeState.userId, userIds),
      });

  const entries: Entry[] = [];
  for (const script of ordered) {
    try {
      entries.push(
        BASELINE ? await baseline(script) : await regenerate(script),
      );
      console.log(`ok ${script.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`échec ${script.id} : ${message}`);
      entries.push({
        scriptId: script.id,
        platform: script.platform,
        contentType: script.contentType,
        visualFormat: null,
        durationMs: null,
        context: {},
        post: {},
        design: null,
        trace: null,
        error: message,
      });
    }
  }

  for (const saved of savedStates) {
    const now = await db.query.narrativeState.findFirst({
      where: eq(narrativeState.id, saved.id),
    });
    if (now && JSON.stringify(now) !== JSON.stringify(saved)) {
      const { id, ...values } = saved;
      await db
        .update(narrativeState)
        .set(values)
        .where(eq(narrativeState.id, id));
      console.log(`état narratif ${id} restauré`);
    }
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        baseline: BASELINE,
        forcedProductId: FORCED_PRODUCT_ID,
        entries,
      },
      null,
      2,
    ),
    "utf-8",
  );
  console.log(`écrit ${OUT}`);
  process.exit(0);
}

main();
