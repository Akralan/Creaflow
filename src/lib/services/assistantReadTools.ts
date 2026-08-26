import { and, asc, between, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { calendarEntries, creatorProfiles, scripts, sourceMaterials } from "@/db/schema";
import type { LlmToolDefinition } from "@/lib/llm/types";
import { getMaterialForUser, listMaterialsForSubject } from "@/lib/services/sourceMaterialService";
import { resolveNarrativeState } from "@/lib/services/narrativeDirector";
import { ApiError } from "@/lib/api/errors";

/**
 * Outils de LECTURE de l'assistant éditorial (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.1).
 *
 * Aucun effet de bord : ces outils répondent, ils n'écrivent jamais. Les écritures passent
 * exclusivement par des propositions à valider (§4) et vivent ailleurs.
 *
 * Deux principes de dosage, pour que la boucle ne se noie pas dans son propre contexte (§2.3) :
 * les listes renvoient des résumés et des projections courtes, le texte intégral ne sort que sur
 * un `read_*` explicite ; et tout est plafonné.
 */

const MATERIAL_TEXT_LIMIT = 12_000;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;

/** L'assistant désigne le corpus de niveau marque par l'absence de sujet — même convention que
 *  sourceMaterialService (productId null = matière non rattachée à un sujet précis). */
const subjectSchema = z.object({ productId: z.string().nullish() });

const readMaterialSchema = z.object({ materialId: z.string().min(1) });
const listScriptsSchema = z.object({
  productId: z.string().nullish(),
  status: z.enum(["draft", "planned", "shot", "published"]).optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
});
const readScriptSchema = z.object({ scriptId: z.string().min(1) });
const readCalendarSchema = z.object({ from: z.string().min(1), to: z.string().min(1) });
const readPerformanceSchema = z.object({ platform: z.string().optional() });
const narrativeSchema = z.object({ productId: z.string().nullish(), seriesId: z.string().nullish() });

function parseDay(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, `Date invalide pour ${field} : "${value}" (format attendu AAAA-MM-JJ).`);
  }
  return parsed;
}

function truncate(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: `${text.slice(0, limit)}…`, truncated: true };
}

function engagementRate(m: { views: number; likes: number; comments: number; shares: number }): number {
  return (m.likes + m.comments + m.shares) / Math.max(m.views, 1);
}

export const ASSISTANT_READ_TOOLS: LlmToolDefinition[] = [
  {
    name: "list_materials",
    description:
      "Liste les documents de matière première d'un sujet (ou la matière de niveau marque si productId est omis) : titre, origine, date et résumé. Renvoie les résumés, jamais le texte intégral — utilise read_material pour lire un document précis.",
    input_schema: {
      type: "object",
      properties: {
        productId: {
          type: "string",
          description: "Id du sujet. Omets-le pour la matière de niveau marque (non rattachée à un sujet).",
        },
      },
      required: [],
    },
  },
  {
    name: "read_material",
    description:
      "Lit le texte intégral d'un document de matière (tronqué s'il est très long). À n'appeler que si le résumé ne suffit pas à répondre.",
    input_schema: {
      type: "object",
      properties: { materialId: { type: "string", description: "Id du document, obtenu via list_materials." } },
      required: ["materialId"],
    },
  },
  {
    name: "list_scripts",
    description:
      "Liste les scripts du créateur, du plus récent au plus ancien : titre, plateforme, statut, rôle, série et intention de génération (concept). Ne renvoie pas le contenu rédigé — utilise read_script pour un script précis.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Restreindre à un sujet précis." },
        status: {
          type: "string",
          enum: ["draft", "planned", "shot", "published"],
          description: "Restreindre à un statut.",
        },
        limit: {
          type: "integer",
          description: `Nombre maximum de scripts (défaut ${DEFAULT_LIST_LIMIT}, plafond ${MAX_LIST_LIMIT}).`,
        },
      },
      required: [],
    },
  },
  {
    name: "read_script",
    description:
      "Lit le contenu d'un script (accroche, storyboard, légende, hashtags) et les passages de matière qu'il cite. Lecture seule : tu ne peux jamais modifier un script.",
    input_schema: {
      type: "object",
      properties: { scriptId: { type: "string", description: "Id du script, obtenu via list_scripts." } },
      required: ["scriptId"],
    },
  },
  {
    name: "read_calendar",
    description:
      "Lit les créneaux de publication planifiés sur une période : date, plateforme, rôle, série, et script associé le cas échéant. Sert à voir la cadence réelle et les trous. Lecture seule : tu ne touches jamais au calendrier.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Début de période, format AAAA-MM-JJ." },
        to: { type: "string", description: "Fin de période, format AAAA-MM-JJ." },
      },
      required: ["from", "to"],
    },
  },
  {
    name: "read_performance",
    description:
      "Métriques réelles des publications (vues, likes, commentaires, partages), agrégées par rôle éditorial et par plateforme, avec le nombre de posts mesurés. Un rôle mesuré sur peu de posts n'est pas un signal fiable.",
    input_schema: {
      type: "object",
      properties: { platform: { type: "string", description: "Restreindre à une plateforme." } },
      required: [],
    },
  },
  {
    name: "read_narrative_state",
    description:
      "État narratif tenu par le rédacteur en chef pour un sujet ou une série en mode feuilleton : arc en cours, épisodes prévus (beats), promesses faites à l'audience et non tenues, détails récurrents.",
    input_schema: {
      type: "object",
      properties: {
        productId: { type: "string", description: "Id du sujet." },
        seriesId: { type: "string", description: "Id de la série. Prioritaire sur productId." },
      },
      required: [],
    },
  },
  {
    name: "read_profile",
    description:
      "Profil complet du créateur : marque, activité, ton, valeurs, équipement, temps disponible par semaine, audience de marque, et profil de style s'il a été calculé.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
];

export const ASSISTANT_READ_TOOL_NAMES = new Set(ASSISTANT_READ_TOOLS.map((t) => t.name));

export async function runAssistantReadTool(userId: string, name: string, rawInput: unknown): Promise<unknown> {
  switch (name) {
    case "list_materials": {
      const { productId } = subjectSchema.parse(rawInput);
      const materials = await listMaterialsForSubject(userId, productId ?? null);
      return {
        subject: productId ?? "marque",
        count: materials.length,
        materials: materials.map((m) => ({
          id: m.id,
          title: m.title,
          kind: m.kind,
          createdAt: m.createdAt,
          characters: m.rawText.length,
          summary: m.summary ?? "(pas encore résumé)",
        })),
      };
    }

    case "read_material": {
      const { materialId } = readMaterialSchema.parse(rawInput);
      const material = await getMaterialForUser(userId, materialId);
      const { text, truncated } = truncate(material.rawText, MATERIAL_TEXT_LIMIT);
      return { id: material.id, title: material.title, kind: material.kind, text, truncated };
    }

    case "list_scripts": {
      const { productId, status, limit } = listScriptsSchema.parse(rawInput);
      const rows = await db.query.scripts.findMany({
        where: and(
          eq(scripts.userId, userId),
          ...(productId ? [eq(scripts.productId, productId)] : []),
          ...(status ? [eq(scripts.status, status)] : [])
        ),
        orderBy: [desc(scripts.createdAt)],
        limit: limit ?? DEFAULT_LIST_LIMIT,
        columns: {
          id: true,
          title: true,
          platform: true,
          status: true,
          contentType: true,
          concept: true,
          origin: true,
          createdAt: true,
        },
        with: {
          contentCategory: { columns: { label: true } },
          series: { columns: { label: true } },
          product: { columns: { name: true } },
        },
      });
      return {
        count: rows.length,
        scripts: rows.map((s) => ({
          id: s.id,
          title: s.title ?? "(sans titre)",
          platform: s.platform,
          status: s.status,
          contentType: s.contentType,
          origin: s.origin,
          createdAt: s.createdAt,
          role: s.contentCategory?.label ?? null,
          series: s.series?.label ?? null,
          subject: s.product?.name ?? null,
          concept: s.concept,
        })),
      };
    }

    case "read_script": {
      const { scriptId } = readScriptSchema.parse(rawInput);
      const script = await db.query.scripts.findFirst({
        where: and(eq(scripts.id, scriptId), eq(scripts.userId, userId)),
        with: {
          contentCategory: { columns: { label: true } },
          series: { columns: { label: true } },
          citations: { columns: { excerpt: true, sourceMaterialId: true } },
        },
      });
      if (!script) {
        throw new ApiError(404, "Script introuvable.");
      }
      return {
        id: script.id,
        title: script.title,
        platform: script.platform,
        status: script.status,
        contentType: script.contentType,
        role: script.contentCategory?.label ?? null,
        series: script.series?.label ?? null,
        concept: script.concept,
        hook: { visual: script.hookVisual, text: script.hookText, audio: script.hookAudio },
        storyboard: script.storyboard,
        caption: script.caption,
        hashtags: script.hashtags,
        citedExcerpts: script.citations.map((c) => c.excerpt),
      };
    }

    case "read_calendar": {
      const { from, to } = readCalendarSchema.parse(rawInput);
      const entries = await db.query.calendarEntries.findMany({
        where: and(
          eq(calendarEntries.userId, userId),
          between(calendarEntries.scheduledDate, parseDay(from, "from"), parseDay(to, "to"))
        ),
        orderBy: [asc(calendarEntries.scheduledDate)],
        with: {
          contentCategory: { columns: { label: true } },
          series: { columns: { label: true } },
          script: { columns: { id: true, title: true, status: true } },
        },
      });
      return {
        from,
        to,
        count: entries.length,
        entries: entries.map((e) => ({
          id: e.id,
          date: e.scheduledDate,
          platform: e.platform,
          status: e.status,
          role: e.contentCategory?.label ?? null,
          series: e.series?.label ?? null,
          // Un créneau sans script est un trou à combler : c'est l'information utile ici.
          script: e.script ? { id: e.script.id, title: e.script.title ?? "(sans titre)", status: e.script.status } : null,
        })),
      };
    }

    case "read_performance": {
      const { platform } = readPerformanceSchema.parse(rawInput);
      const rows = await db.query.scripts.findMany({
        where: and(eq(scripts.userId, userId), ...(platform ? [eq(scripts.platform, platform)] : [])),
        columns: { id: true, title: true, platform: true },
        with: { metrics: true, contentCategory: { columns: { label: true } } },
      });
      const measured = rows.filter((r) => r.metrics);

      const byRole = new Map<string, { platform: string; role: string; posts: number; views: number; engagementTotal: number }>();
      for (const r of measured) {
        const role = r.contentCategory?.label ?? "(sans rôle)";
        const key = `${r.platform}::${role}`;
        const entry = byRole.get(key) ?? { platform: r.platform, role, posts: 0, views: 0, engagementTotal: 0 };
        entry.posts += 1;
        entry.views += r.metrics!.views;
        entry.engagementTotal += engagementRate(r.metrics!);
        byRole.set(key, entry);
      }

      return {
        measuredPosts: measured.length,
        totalPosts: rows.length,
        byRole: Array.from(byRole.values())
          .map((e) => ({
            platform: e.platform,
            role: e.role,
            posts: e.posts,
            totalViews: e.views,
            avgEngagementRate: Number((e.engagementTotal / e.posts).toFixed(4)),
          }))
          .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate),
      };
    }

    case "read_narrative_state": {
      const { productId, seriesId } = narrativeSchema.parse(rawInput);
      const state = await resolveNarrativeState(userId, productId ?? null, seriesId ?? null);
      if (!state) return { exists: false };
      return {
        exists: true,
        // resolveNarrativeState retombe sur l'état de niveau marque quand le sujet/la série demandé
        // n'en a pas : on rend le périmètre effectif explicite, sinon le modèle croit lire l'état du
        // sujet qu'il a demandé.
        scope: state.seriesId ? { seriesId: state.seriesId } : state.productId ? { productId: state.productId } : "marque",
        arcSummary: state.arcSummary,
        formatContract: state.formatContract,
        beats: state.beats,
        openPromises: state.openPromises,
        callbacks: state.callbacks,
        isStale: state.isStale,
        lastPlannedAt: state.lastPlannedAt,
      };
    }

    case "read_profile": {
      const profile = await db.query.creatorProfiles.findFirst({ where: eq(creatorProfiles.userId, userId) });
      if (!profile) return { exists: false };
      const brandLevelMaterial = await db.query.sourceMaterials.findMany({
        where: and(eq(sourceMaterials.userId, userId), isNull(sourceMaterials.productId)),
        columns: { id: true },
      });
      return {
        exists: true,
        brandName: profile.brandName,
        activityType: profile.activityType,
        tone: profile.tone,
        values: profile.values,
        equipment: profile.equipment,
        weeklyTimeAvailable: profile.weeklyTimeAvailable,
        targetAudience: profile.targetAudience,
        styleProfile: profile.styleProfile,
        styleProfileUpdatedAt: profile.styleProfileUpdatedAt,
        brandLevelMaterialCount: brandLevelMaterial.length,
      };
    }

    default:
      throw new ApiError(400, `Outil de lecture inconnu : ${name}.`);
  }
}
