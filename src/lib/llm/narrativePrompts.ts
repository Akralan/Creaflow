import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

// Plafond serveur (docs/SPEC_REDACTEUR_EN_CHEF.md §5) : le prompt (B.1) tient déjà le modèle à 1-2
// phrases / 40 mots, ce plafond est un filet de sécurité, pas la consigne principale.
const MAX_SUMMARY_LENGTH = 300;

const SUMMARIZE_MATERIAL_TOOL_NAME = "summarize_material";

const summarizeMaterialTool: LlmToolDefinition = {
  name: SUMMARIZE_MATERIAL_TOOL_NAME,
  description: "Résume le potentiel narratif d'un document de matière première.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "Le résumé narratif du document en 1-2 phrases, 40 mots maximum.",
      },
    },
    required: ["summary"],
  },
};

// Annexe B.1, verbatim.
const SUMMARIZE_MATERIAL_SYSTEM_PROMPT = `Tu résumes un document de matière première pour la direction éditoriale d'un créateur de contenu. En 1 à 2 phrases (40 mots maximum), dis ce qui s'est PASSÉ dans ce document et où est son potentiel narratif : l'événement, le changement, le chiffre marquant, l'échec, la décision ou la surprise. Ne décris pas le document ("ce document contient...") : raconte ce qu'il apprend. S'il ne contient que des données sans événement, dis-le en une phrase factuelle. Réponds via l'outil fourni.`;

const materialSummarySchema = z.object({ summary: z.string() });

/**
 * Résumeur de document (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1) — un seul document par appel, c'est la
 * condition de lecture optimale. Le texte intégral est envoyé tel quel, jamais tronqué côté client :
 * c'est le seul appel du chef qui lit un document en entier (les deux autres, à venir en Lot B3, ne
 * verront jamais que ce résumé).
 */
export async function summarizeMaterial(rawText: string, title?: string | null): Promise<string> {
  const userMessage = title ? `[${title}]\n${rawText}` : rawText;
  const args = await callStructured({
    system: SUMMARIZE_MATERIAL_SYSTEM_PROMPT,
    userMessage,
    tool: summarizeMaterialTool,
    maxTokens: 256,
  });
  const { summary } = materialSummarySchema.parse(args);
  return summary.length > MAX_SUMMARY_LENGTH ? summary.slice(0, MAX_SUMMARY_LENGTH) : summary;
}

// ---------------------------------------------------------------------------------------------
// Rédacteur en chef — système prompt commun (Annexe B.2) et planification glissante (B.2a/B.5).
// ---------------------------------------------------------------------------------------------

/** Annexe B.2, verbatim — commun aux deux appels du chef (planification ici, choix du jour en Lot B3). */
export function narrativeDirectorSystemPrompt(brandName: string, activityType: string): string {
  return `Tu es le rédacteur en chef de ${brandName} (${activityType}). Tu ne rédiges jamais de post : tu décides de l'histoire — quel épisode raconter, dans quel ordre, pour construire une audience qui comprend, s'attache et revient.

Principes :
- Une audience se construit dans l'ordre : on présente le projet et les personnes avant d'approfondir, on pose les enjeux avant les détails techniques, on explique une notion avant de s'appuyer dessus.
- Un épisode = UN moment (un événement, une décision, un échec, un chiffre marquant) — jamais un condensé de plusieurs choses.
- Les promesses faites à l'audience sont sacrées : une promesse ouverte doit être honorée avant d'en accumuler de nouvelles.
- Les callbacks — les détails récurrents devenus familiers — créent l'attachement : réutilise-les quand c'est naturel, sans forcer.
- Tu ne connais des documents que leurs résumés : tu pointes des documents (focusDocIds), tu n'affirmes jamais un fait précis toi-même — c'est le rédacteur qui lira les documents complets et citera.
- Un plan est une hypothèse, pas un contrat : la nouvelle matière, ce qui a réellement été publié et les idées du créateur le font évoluer.`;
}

// Annexe B.2a, verbatim.
const PLAN_NARRATIVE_INSTRUCTIONS = `Mets à jour le plan éditorial via l'outil fourni.
- Conserve l'id et le statut des beats existants ; ne rétrograde jamais un beat publié ; réordonne ou ajoute librement les beats non publiés.
- Si l'audience de ce sujet est vide (aucun post publié), les premiers beats présentent : le créateur/le projet (kind "personal"), puis le contexte et les notions nécessaires (kind "pedagogical" ou "material"), avant tout épisode d'avancement.
- Un beat "material" pointe 1 à 3 documents (focusDocIds) — ceux où se trouve CE moment, pas tous les documents qui l'effleurent.
- Privilégie les documents non encore exploités ; un document déjà exploité peut resservir seulement sous un angle réellement différent.
- Si le créateur a fourni une idée, intègre-la comme un détour d'arc assumé : un beat qui l'interprète, placé où il sert le mieux l'histoire.`;

const UPDATE_NARRATIVE_PLAN_TOOL_NAME = "update_narrative_plan";

const narrativeBeatKindSchema = ["material", "pedagogical", "personal"] as const;
const narrativeBeatStatusSchema = ["planned", "drafted", "published", "skipped"] as const;

const updateNarrativePlanTool: LlmToolDefinition = {
  name: UPDATE_NARRATIVE_PLAN_TOOL_NAME,
  description: "Met à jour le plan éditorial du sujet : où en est l'histoire, et les épisodes à venir.",
  input_schema: {
    type: "object",
    properties: {
      arcSummary: {
        type: "string",
        description: "Où en est l'histoire racontée à l'audience, en 2 à 4 phrases : ce qu'elle sait déjà, ce qu'elle attend.",
      },
      beats: {
        type: "array",
        description: "Le plan ordonné. Conserve les ids et statuts existants ; ne rétrograde jamais un beat publié.",
        items: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Id court et stable. Réutilise l'id d'un beat existant ; invente un id court pour un nouveau beat.",
            },
            title: { type: "string", description: "Le moment raconté, pas un thème. « La percée du run 31 », jamais « Les runs »." },
            kind: {
              type: "string",
              enum: [...narrativeBeatKindSchema],
              description:
                "material : le récit vient des documents. pedagogical : explication d'une notion du domaine, sans document. personal : présentation du créateur/projet, source profil.",
            },
            angleHint: {
              type: "string",
              description: "Forme de hook recommandée pour cet épisode, une ligne. Chaîne vide si aucune recommandation particulière.",
            },
            focusDocIds: {
              type: "array",
              items: { type: "string" },
              description: "1 à 3 ids de documents où se trouve CE moment (kind material). [] pour pedagogical et personal.",
            },
            status: {
              type: "string",
              enum: [...narrativeBeatStatusSchema],
              description: "planned | drafted | published | skipped. Jamais published de ta propre initiative.",
            },
            rationale: { type: "string", description: "Pourquoi ce beat, à cette place — une ligne." },
          },
          required: ["id", "title", "kind", "angleHint", "focusDocIds", "status", "rationale"],
        },
      },
      callbacks: {
        type: "array",
        items: { type: "string" },
        description: "Les détails récurrents de l'histoire devenus familiers pour l'audience (max 8).",
      },
    },
    required: ["arcSummary", "beats", "callbacks"],
  },
};

// Forme brute renvoyée par le LLM — sans `scriptId` (jamais affirmé par le chef, cf. B.2 principe 5 :
// c'est le serveur qui le préserve/assigne au merge, voir narrativeDirector.ts).
const llmNarrativeBeatSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(narrativeBeatKindSchema),
  // Même pattern que visionSchema.ts (matchedProductName) : chaîne vide plutôt qu'une union JSON
  // Schema avec null, mal supportée par certains convertisseurs de function-calling.
  angleHint: z.string().transform((v) => v.trim() || null),
  focusDocIds: z.array(z.string()).max(3),
  status: z.enum(narrativeBeatStatusSchema),
  rationale: z.string().min(1),
});
export type LlmNarrativeBeat = z.infer<typeof llmNarrativeBeatSchema>;

const updateNarrativePlanResultSchema = z.object({
  arcSummary: z.string().min(1),
  beats: z.array(llmNarrativeBeatSchema),
  callbacks: z.array(z.string()),
});
export type UpdateNarrativePlanResult = z.infer<typeof updateNarrativePlanResultSchema>;

export interface NarrativePlanDocumentContext {
  id: string;
  summary: string | null;
  /** Dérivé des citations existantes (au moins un passage déjà cité) — pas une annotation stockée. */
  alreadyUsed: boolean;
}

export interface NarrativePlanExistingBeat {
  id: string;
  title: string;
  kind: (typeof narrativeBeatKindSchema)[number];
  status: (typeof narrativeBeatStatusSchema)[number];
  rationale: string;
}

export interface NarrativePlanContext {
  brandName: string;
  activityType: string;
  targetAudience?: string | null;
  subjectLabel: string;
  arcSummary: string | null;
  beats: NarrativePlanExistingBeat[];
  callbacks: string[];
  formatContract: string | null;
  documents: NarrativePlanDocumentContext[];
  publishedConcepts: string[];
  directive?: string | null;
}

function buildNarrativePlanUserMessage(context: NarrativePlanContext): string {
  const lines: string[] = [
    `Sujet : ${context.subjectLabel}`,
    context.targetAudience ? `Audience visée : ${context.targetAudience}` : null,
    `Arc actuel : ${context.arcSummary ?? "aucun — c'est la première planification de ce sujet."}`,
    context.beats.length > 0
      ? `Beats existants :\n${context.beats
          .map((b) => `- [${b.id}] (${b.status}, ${b.kind}) ${b.title} — ${b.rationale}`)
          .join("\n")}`
      : "Aucun beat existant — plan à créer de zéro.",
    context.callbacks.length > 0 ? `Callbacks existants : ${context.callbacks.join(" ; ")}` : null,
    context.formatContract ? `Contrat de format (mode rendez-vous) : ${context.formatContract}` : null,
    context.documents.length > 0
      ? `Documents disponibles sur ce sujet (résumés) :\n${context.documents
          .map((d) => `- [${d.id}]${d.alreadyUsed ? " (déjà exploité)" : ""} ${d.summary ?? "(résumé pas encore disponible)"}`)
          .join("\n")}`
      : "Aucun document de matière déposé sur ce sujet.",
    context.publishedConcepts.length > 0
      ? `Posts déjà publiés sur ce sujet (ne pas répéter) : ${context.publishedConcepts.join(" ; ")}`
      : "Aucun post publié sur ce sujet pour l'instant — l'audience part de zéro.",
    context.directive ? `Idée soufflée par le créateur à intégrer au plan : ${context.directive}` : null,
  ].filter((l): l is string => l !== null);

  return `${lines.join("\n")}\n\n${PLAN_NARRATIVE_INSTRUCTIONS}`;
}

/** Planification glissante (docs/SPEC_REDACTEUR_EN_CHEF.md §3.2) — un appel, quel que soit le volume
 *  de beats existants (plafonné en amont par l'appelant, cf. narrativeDirector.ts). */
export async function planNarrative(context: NarrativePlanContext): Promise<UpdateNarrativePlanResult> {
  const args = await callStructured({
    system: narrativeDirectorSystemPrompt(context.brandName, context.activityType),
    userMessage: buildNarrativePlanUserMessage(context),
    tool: updateNarrativePlanTool,
    maxTokens: 4096,
  });
  return updateNarrativePlanResultSchema.parse(args);
}
