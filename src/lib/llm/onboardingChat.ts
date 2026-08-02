import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

export interface OnboardingMessage {
  role: "user" | "assistant";
  content: string;
}

export const extractedProfileSchema = z.object({
  brandName: z.string().optional(),
  activityType: z.string().optional(),
  tone: z.string().optional(),
  values: z.string().optional(),
  equipment: z.array(z.string()).optional(),
  weeklyTimeAvailable: z.string().optional(),
  suggestedPlatforms: z.array(z.string()).optional(),
});
export type ExtractedOnboardingProfile = z.infer<typeof extractedProfileSchema>;

export const onboardingChatResultSchema = z.object({
  assistantReply: z.string().min(1),
  extractedFields: extractedProfileSchema,
  complete: z.boolean(),
});
export type OnboardingChatResult = z.infer<typeof onboardingChatResultSchema>;

const UPDATE_ONBOARDING_PROFILE_TOOL_NAME = "update_onboarding_profile";
const KNOWN_PLATFORM_KEYS = KNOWN_PLATFORMS.map((p) => p.key);

const updateOnboardingProfileTool: LlmToolDefinition = {
  name: UPDATE_ONBOARDING_PROFILE_TOOL_NAME,
  description:
    "Répond au message de l'utilisateur et met à jour les informations de profil déduites de la conversation jusqu'ici.",
  input_schema: {
    type: "object",
    properties: {
      assistantReply: {
        type: "string",
        description: "Réponse conversationnelle à afficher à l'utilisateur — pose UNE question à la fois.",
      },
      extractedFields: {
        type: "object",
        description:
          "Renvoie la valeur la plus à jour pour CHAQUE champ déjà connu (pas seulement les nouveaux) déduite de TOUTE la conversation jusqu'ici, en plus des nouveaux champs appris à ce tour.",
        properties: {
          brandName: { type: "string", description: "Nom de la marque, de l'activité ou du projet." },
          activityType: {
            type: "string",
            description: "Description courte de l'activité (ex: 'bijoux artisanaux', 'développeur freelance produits web').",
          },
          tone: { type: "string", description: "Ton de communication souhaité." },
          values: { type: "string", description: "Valeurs ou positionnement." },
          equipment: {
            type: "array",
            items: { type: "string" },
            description: "Matériel de production disponible, seulement si pertinent pour ce type de contenu.",
          },
          weeklyTimeAvailable: { type: "string", description: "Temps disponible par semaine pour produire du contenu." },
          suggestedPlatforms: {
            type: "array",
            items: { type: "string", enum: KNOWN_PLATFORM_KEYS },
            description: "Plateformes pertinentes pour cette activité, uniquement parmi la liste autorisée.",
          },
        },
      },
      complete: {
        type: "boolean",
        description:
          "true seulement quand brandName, activityType, weeklyTimeAvailable et au moins une plateforme suggérée sont connus — sinon false et continue la conversation.",
      },
    },
    required: ["assistantReply", "extractedFields", "complete"],
  },
};

const SYSTEM_PROMPT = `Tu es l'assistant d'onboarding de CreaFlow. Ton rôle est de mener une conversation naturelle et courte avec un nouvel utilisateur pour comprendre son activité — qu'il s'agisse d'un artisan, d'une entreprise, d'un freelance, ou tout autre type d'activité produisant du contenu social media — puis de lui recommander les réseaux sociaux les plus pertinents pour lui.

Règles :
- Pose une seule question à la fois, de façon conversationnelle, jamais un formulaire déguisé.
- Ne suppose jamais que l'utilisateur fait de la vidéo ou vend des produits physiques — adapte-toi entièrement à ce qu'il décrit.
- Dès que tu as assez d'informations sur : le nom/l'activité, une description de l'activité, le temps disponible par semaine, et au moins une plateforme pertinente pour ce type d'activité, marque complete=true et termine par un message de récapitulatif chaleureux.
- Ne suggère que des plateformes parmi celles-ci : ${KNOWN_PLATFORM_KEYS.join(", ")}.`;

export interface OnboardingChatContext {
  history: OnboardingMessage[];
}

export async function runOnboardingChatTurn(context: OnboardingChatContext): Promise<OnboardingChatResult> {
  const transcript = context.history
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`)
    .join("\n");

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: transcript,
    tool: updateOnboardingProfileTool,
    maxTokens: 1024,
  });

  return onboardingChatResultSchema.parse(args);
}
