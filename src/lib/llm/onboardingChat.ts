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
  // Audience de marque (docs/SPEC_PROMPT_GENERATION_TECH.md §5/Annexe A.7) — skippable, ne fait
  // jamais partie des critères de `complete` ci-dessous.
  targetAudience: z.string().optional(),
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
          targetAudience: {
            type: "string",
            description: "Audience visée : qui achète ou lit, ce qui l'intéresse, ce qu'il doit retenir de la marque. Champ optionnel, ne pas insister si l'utilisateur ne sait pas répondre ou préfère passer.",
          },
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
- Ne suggère que des plateformes parmi celles-ci : ${KNOWN_PLATFORM_KEYS.join(", ")}.
- Cherche aussi à connaître l'audience visée : qui achète ou lit, ce qui intéresse ces personnes, ce qu'elles doivent retenir de la marque. Pose une question simple, avec un exemple adapté à l'activité décrite. Si la personne ne sait pas répondre ou préfère passer, n'insiste pas : ce champ n'est pas nécessaire pour terminer l'onboarding.`;

export interface OnboardingChatContext {
  history: OnboardingMessage[];
}

/** Même contrat de sortie que le tool généraliste, moins `equipment` : hors sujet pour du contenu de
 *  dev, majoritairement textuel. Dérivé plutôt que recopié pour qu'une évolution du schéma partagé
 *  (nouveau champ de profil) ne se perde pas dans un seul des deux parcours. */
export const devOnboardingProfileTool: LlmToolDefinition = (() => {
  const base = updateOnboardingProfileTool.input_schema.properties.extractedFields as {
    type: string;
    description: string;
    properties: Record<string, unknown>;
  };
  const properties = { ...base.properties };
  delete properties.equipment;
  return {
    ...updateOnboardingProfileTool,
    input_schema: {
      ...updateOnboardingProfileTool.input_schema,
      properties: {
        ...updateOnboardingProfileTool.input_schema.properties,
        extractedFields: { ...base, properties },
      },
    },
  };
})();

export const DEV_SYSTEM_PROMPT = `Tu es l'assistant d'onboarding de CreaFlow. La personne en face de toi est développeuse : elle vient de connecter son compte GitHub et de choisir les projets dont elle veut parler. Tu connais déjà son identité et ses projets, ils te sont donnés en contexte.

Règles :
- Tu as déjà de quoi déduire brandName et activityType depuis le profil GitHub et les projets. Ne les demande PAS à froid : propose-les en récapitulatif court, et laisse corriger.
- Tu n'as droit qu'à DEUX ou TROIS questions au total, une à la fois : le ton de communication souhaité, l'audience visée, et le temps disponible par semaine. Rien d'autre.
- Ne demande JAMAIS le matériel de production (caméra, micro, lumière) : le contenu d'un développeur est essentiellement écrit, la question serait absurde.
- Ne suppose pas qu'il s'agit de vidéo. Suggère en priorité les réseaux où l'écrit et le technique fonctionnent, mais uniquement parmi : ${KNOWN_PLATFORM_KEYS.join(", ")}.
- L'audience visée est utile mais optionnelle : si la personne ne sait pas répondre ou préfère passer, n'insiste pas.
- Marque complete=true dès que brandName, activityType, weeklyTimeAvailable et au moins une plateforme sont connus, et termine par un récapitulatif court.`;

export interface DevOnboardingContext {
  login: string;
  name: string | null;
  bio: string | null;
  subjects: Array<{
    name: string;
    description: string | null;
    language: string | null;
    readmeExcerpt: string | null;
  }>;
}

/** Bloc de contexte préfixé à la transcription — c'est ce qui permet au modèle de ne pas reposer les
 *  questions dont GitHub a déjà la réponse. */
export function buildDevContext(input: DevOnboardingContext): string {
  const lines: string[] = ["Profil GitHub :", `- identifiant : ${input.login}`];
  if (input.name) lines.push(`- nom : ${input.name}`);
  if (input.bio) lines.push(`- bio : ${input.bio}`);

  lines.push("", "Projets retenus comme sujets :");
  for (const subject of input.subjects) {
    const details = [subject.language, subject.description].filter(Boolean).join(" · ");
    lines.push(`- ${subject.name}${details ? ` (${details})` : ""}`);
    if (subject.readmeExcerpt) {
      lines.push(`  extrait du README : ${subject.readmeExcerpt}`);
    }
  }

  return lines.join("\n");
}

export async function runDevOnboardingChatTurn(context: {
  history: OnboardingMessage[];
  dev: DevOnboardingContext;
}): Promise<OnboardingChatResult> {
  const transcript = context.history
    .map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`)
    .join("\n");

  const args = await callStructured({
    system: DEV_SYSTEM_PROMPT,
    userMessage: `${buildDevContext(context.dev)}\n\n---\n\n${transcript}`,
    tool: devOnboardingProfileTool,
    maxTokens: 1024,
  });

  return onboardingChatResultSchema.parse(args);
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
