import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import type { OnboardingMessage } from "./onboardingChat";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";

export type AssistantMessage = OnboardingMessage;

const proposalActionSchema = z.enum(["create", "update"]);
const KNOWN_PLATFORM_KEYS = KNOWN_PLATFORMS.map((p) => p.key);

export const productProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
});
export type ProductProposal = z.infer<typeof productProposalSchema>;

export const seriesProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(0).max(60),
  categoryLabels: z.array(z.string().min(1)),
  platforms: z.array(z.string()),
});
export type SeriesProposal = z.infer<typeof seriesProposalSchema>;

export const categoryProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(5).max(90),
  platforms: z.array(z.string()),
});
export type CategoryProposal = z.infer<typeof categoryProposalSchema>;

export const angleProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
});
export type AngleProposal = z.infer<typeof angleProposalSchema>;

export const postingGoalProposalSchema = z.object({
  platform: z.string().min(1),
  targetCountPerWeek: z.number().min(0).max(30),
});
export type PostingGoalProposal = z.infer<typeof postingGoalProposalSchema>;

export const assistantChatResultSchema = z.object({
  assistantReply: z.string().min(1),
  productProposals: z.array(productProposalSchema).max(5),
  seriesProposals: z.array(seriesProposalSchema).max(5),
  categoryProposals: z.array(categoryProposalSchema).max(5),
  angleProposals: z.array(angleProposalSchema).max(5),
  postingGoalProposals: z.array(postingGoalProposalSchema).max(5),
});
export type AssistantChatResult = z.infer<typeof assistantChatResultSchema>;

const ASSISTANT_CHAT_TOOL_NAME = "update_assistant_conversation";

/** `enum` sur une valeur censée matcher exactement une valeur existante — omis quand la liste est
 *  vide, un `enum: []` rejetterait toute valeur. */
function enumField(values: string[], description: string) {
  return values.length > 0 ? { type: "string", description, enum: values } : { type: "string", description };
}

function buildAssistantTool(context: {
  productIds: string[];
  seriesIds: string[];
  categoryIds: string[];
  categoryLabels: string[];
  angleIds: string[];
  platformKeys: string[];
}): LlmToolDefinition {
  const platformsField = {
    type: "array",
    description:
      "Réseaux pertinents, à déduire du contexte de la conversation. Tableau VIDE si aucun signal clair (= tous les réseaux, comportement par défaut) — ne restreins qu'avec une bonne raison exprimée par l'utilisateur. Pour une mise à jour, reprends les plateformes actuelles sauf changement explicitement demandé.",
    items: enumField(context.platformKeys, "Clé de plateforme connue (parmi le registre)."),
  };

  return {
    name: ASSISTANT_CHAT_TOOL_NAME,
    description:
      "Répond au message de l'utilisateur et propose, si pertinent, des créations ou modifications de produits, catégories de contenu, angles, séries récurrentes, et objectifs de fréquence par plateforme.",
    input_schema: {
      type: "object",
      properties: {
        assistantReply: {
          type: "string",
          description: "Réponse conversationnelle à afficher à l'utilisateur — pose UNE question à la fois si besoin de clarifier.",
        },
        productProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification de produit. La plupart des tours n'en proposent aucune — seulement quand l'utilisateur a donné assez d'info sur un produit nouveau ou existant.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour un nouveau produit, 'update' pour modifier un produit existant." },
              targetId: enumField(context.productIds, "Id EXACT du produit existant à modifier — uniquement si action='update'."),
              name: { type: "string", description: "Nom du produit (valeur complète à jour, même pour une modification partielle)." },
              description: { type: "string", description: "Description du produit." },
              valueProposition: { type: "string", description: "Proposition de valeur du produit." },
            },
            required: ["action", "name"],
          },
        },
        seriesProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification de série récurrente ('direction'). La plupart des tours n'en proposent aucune.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour une nouvelle série, 'update' pour modifier une série existante." },
              targetId: enumField(context.seriesIds, "Id EXACT de la série existante à modifier — uniquement si action='update'."),
              label: { type: "string", description: "Nom court et mémorable de la série." },
              description: { type: "string", description: "Identité de la série : angle, ton, structure à respecter." },
              weight: { type: "integer", description: "Pourcentage approximatif des créneaux mensuels (0 à 60)." },
              categoryLabels: {
                type: "array",
                description: "Une ou plusieurs catégories de contenu actives auxquelles cette série appartient.",
                items: enumField(context.categoryLabels, "Libellé exact d'une catégorie de contenu active."),
              },
              platforms: platformsField,
            },
            required: ["action", "label", "description", "weight", "categoryLabels", "platforms"],
          },
        },
        categoryProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification de catégorie de contenu. La plupart des tours n'en proposent aucune.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour une nouvelle catégorie, 'update' pour modifier une catégorie existante." },
              targetId: enumField(context.categoryIds, "Id EXACT de la catégorie existante à modifier — uniquement si action='update'."),
              label: { type: "string", description: "Libellé court de la catégorie." },
              description: { type: "string", description: "Consigne éditoriale de la catégorie." },
              weight: {
                type: "integer",
                description:
                  "Poids de CETTE catégorie uniquement (5 à 90, % approximatif des créneaux). Ne propose JAMAIS le poids des autres catégories — elles seront réajustées automatiquement pour continuer à sommer à 100%.",
              },
              platforms: platformsField,
            },
            required: ["action", "label", "description", "weight", "platforms"],
          },
        },
        angleProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification d'angle de contenu (variation de traitement au sein d'une catégorie). La plupart des tours n'en proposent aucune.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour un nouvel angle, 'update' pour modifier un angle existant." },
              targetId: enumField(context.angleIds, "Id EXACT de l'angle existant à modifier — uniquement si action='update'."),
              label: { type: "string", description: "Nom court de l'angle." },
              description: { type: "string", description: "Consigne de traitement associée à cet angle." },
            },
            required: ["action", "label", "description"],
          },
        },
        postingGoalProposals: {
          type: "array",
          description:
            "0 à 5 propositions de mise à jour d'objectif de fréquence hebdomadaire par plateforme. Pas de distinction create/update : la plateforme identifie la cible.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              platform: enumField(context.platformKeys, "Clé de plateforme connue (parmi le registre)."),
              targetCountPerWeek: {
                type: "number",
                description: "Objectif hebdomadaire (0 à 30, par pas de 0.5 — ex: 0.5 = 1 publication toutes les 2 semaines).",
              },
            },
            required: ["platform", "targetCountPerWeek"],
          },
        },
      },
      required: ["assistantReply", "productProposals", "seriesProposals", "categoryProposals", "angleProposals", "postingGoalProposals"],
    },
  };
}

const SYSTEM_PROMPT = `Tu es l'assistant éditorial de CreaFlow. Tu discutes avec l'utilisateur de sa direction éditoriale et des paramètres de son calendrier de publication, et tu proposes, quand c'est pertinent, des créations ou modifications de PRODUITS, CATÉGORIES DE CONTENU, ANGLES, SÉRIES récurrentes, et OBJECTIFS DE FRÉQUENCE par plateforme.

Règles :
- Pose une seule question à la fois, de façon conversationnelle.
- Ne propose une création/modification que quand tu as assez d'info — la plupart des tours ne doivent rien proposer (tableaux vides).
- Tu ne peux JAMAIS proposer de suppression ou d'archivage — uniquement 'create' ou 'update' (les objectifs de fréquence n'ont qu'une seule forme, sans distinction create/update : la plateforme identifie la cible, la valeur existante est simplement remplacée).
- Pour 'update', utilise TOUJOURS l'id EXACT fourni dans le contexte (produits/séries/catégories/angles existants) — n'invente jamais d'id, et n'utilise 'update' que si l'utilisateur décrit clairement un élément déjà existant.
- Pour les séries, utilise les libellés de catégories EXACTS fournis dans le contexte.
- Pour une catégorie, ne propose QUE le poids de la catégorie concernée (5 à 90) — jamais celui des autres, elles seront réajustées automatiquement pour continuer à sommer à 100%.
- Pour les plateformes (séries et catégories), utilise UNIQUEMENT les clés du registre fourni. Ne restreins à des plateformes précises que si le contexte de la conversation le justifie clairement (ex. l'utilisateur mentionne un réseau en particulier) — sinon laisse le tableau vide (= toutes les plateformes), ne sur-scope jamais sans raison. Pour une mise à jour, restitue les plateformes actuelles de l'élément sauf changement explicitement demandé.
- Tu ne proposes JAMAIS d'action sur le calendrier lui-même : pas de génération de mois, pas de création/déplacement/suppression de créneau. Ton rôle s'arrête aux données qui alimentent le calendrier (catégories, angles, séries, objectifs de fréquence) — jamais le calendrier généré.
- Rien n'est jamais enregistré directement : chaque proposition sera relue, éditée ou refusée par l'utilisateur avant d'être appliquée — tu peux donc proposer dès que c'est raisonnable, sans sur-demander de confirmation.
- Tu ne dois JAMAIS inventer une information (nom, caractéristique, chiffre, date...) qui ne t'a pas été donnée explicitement par l'utilisateur ou par une source fournie. En cas de doute ou d'info manquante, pose une question de clarification plutôt que de deviner.`;

export interface AssistantChatContext {
  history: AssistantMessage[];
  products: Array<{ id: string; name: string; description?: string | null; valueProposition?: string | null }>;
  series: Array<{
    id: string;
    label: string;
    description: string;
    weight: number;
    categories: Array<{ label: string }>;
    platforms: string[];
  }>;
  categories: Array<{ id: string; label: string; description: string; weight: number; platforms: string[] }>;
  angles: Array<{ id: string; label: string; description: string }>;
  postingGoals: Array<{ platform: string; targetCountPerWeek: number }>;
  sources?: Array<{ url: string; text: string }>;
}

export async function runAssistantChatTurn(context: AssistantChatContext): Promise<AssistantChatResult> {
  const transcript = context.history
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`)
    .join("\n");

  const contextLines = [
    context.products.length > 0
      ? `Produits existants : ${context.products.map((p) => `[id:${p.id}] ${p.name}${p.description ? ` — ${p.description}` : ""}`).join(" ; ")}`
      : "Aucun produit enregistré pour l'instant.",
    context.series.length > 0
      ? `Séries existantes : ${context.series
          .map(
            (s) =>
              `[id:${s.id}] ${s.label} (${s.weight}%) — ${s.description} [catégories : ${s.categories.map((c) => c.label).join(", ")}]${
                s.platforms.length > 0 ? ` [plateformes : ${s.platforms.join(", ")}]` : " [tous réseaux]"
              }`
          )
          .join(" ; ")}`
      : "Aucune série active pour l'instant.",
    context.categories.length > 0
      ? `Catégories de contenu actives : ${context.categories
          .map(
            (c) =>
              `[id:${c.id}] ${c.label} (${c.weight}%)${c.platforms.length > 0 ? ` [plateformes : ${c.platforms.join(", ")}]` : " [tous réseaux]"}`
          )
          .join(" ; ")}`
      : "Aucune catégorie de contenu active pour l'instant.",
    context.angles.length > 0
      ? `Angles actifs : ${context.angles.map((a) => `[id:${a.id}] ${a.label} — ${a.description}`).join(" ; ")}`
      : "Aucun angle actif pour l'instant.",
    context.postingGoals.length > 0
      ? `Objectifs de fréquence actuels : ${context.postingGoals
          .map((g) => `${platformLabel(g.platform)} : ${g.targetCountPerWeek}/semaine`)
          .join(" ; ")}`
      : "Aucun objectif de fréquence défini pour l'instant.",
  ];

  const sourceBlocks = (context.sources ?? []).map((s) => `--- Source : ${s.url} ---\n${s.text}`);

  const userMessage = [
    ...contextLines,
    ...(sourceBlocks.length > 0
      ? [
          "",
          "Informations extraites de pages web fournies par l'utilisateur pour ce tour (contexte factuel, ne rien inventer au-delà) :",
          ...sourceBlocks,
        ]
      : []),
    "",
    transcript,
  ].join("\n");

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage,
    tool: buildAssistantTool({
      productIds: context.products.map((p) => p.id),
      seriesIds: context.series.map((s) => s.id),
      categoryIds: context.categories.map((c) => c.id),
      categoryLabels: context.categories.map((c) => c.label),
      angleIds: context.angles.map((a) => a.id),
      platformKeys: KNOWN_PLATFORM_KEYS,
    }),
    maxTokens: 1536,
  });

  return assistantChatResultSchema.parse(args);
}
