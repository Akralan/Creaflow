import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Extraction du profil à l'onboarding (docs/SPEC_ONBOARDING_MVP.md §3 bis, §4) : un seul appel
 * remplace l'ancien chat. Ce que la personne fait se LIT dans sa matière ; elle n'a qu'à corriger.
 *
 * Chaque source branchée et chaque bloc de notes collées porte une clé (`source:<id>`, `note:<id>`)
 * que le modèle range dans des sujets : c'est ainsi que le dépôt GitHub, la base Notion et le projet
 * Linear d'un même produit finissent sur un seul sujet.
 */

export interface ProfileExtractionInput {
  name: string;
  /** Comptes tiers reliés : nom, login et bio GitHub disent déjà beaucoup de qui écrit. */
  identities: Array<{ provider: string; login: string; name: string | null; bio: string | null }>;
  items: Array<{ key: string; kind: string; label: string; excerpt: string }>;
}

export const extractedSubjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  keys: z.array(z.string()).default([]),
});

export const extractedProfileSchema = z.object({
  activityType: z.string().default(""),
  targetAudience: z.string().default(""),
  subjects: z.array(extractedSubjectSchema).default([]),
});

export type ExtractedSubject = z.infer<typeof extractedSubjectSchema>;
export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;

const TOOL_NAME = "describe_author";

const describeAuthorTool: LlmToolDefinition = {
  name: TOOL_NAME,
  description: "Décrit ce que fait l'auteur et regroupe ses sources par projet, à partir de sa matière.",
  input_schema: {
    type: "object",
    properties: {
      activityType: {
        type: "string",
        description:
          "Ce que fait l'auteur, à la deuxième personne, en une ou deux phrases concrètes (« Tu construis X, un outil qui… »). Uniquement ce que la matière montre.",
      },
      targetAudience: {
        type: "string",
        description: "Pour qui il construit, en une phrase : les gens que son travail sert. Vide si la matière ne permet pas de le dire.",
      },
      subjects: {
        type: "array",
        description:
          "Les projets de l'auteur. Un projet regroupe TOUTES les sources qui en parlent, même vues sous des angles différents (le code sur GitHub, la réflexion dans Notion, les tâches dans Linear). Une source qui ne recoupe rien forme un projet à elle seule.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Nom du projet, court, tel que l'auteur l'appellerait." },
            description: { type: "string", description: "Ce qu'est le projet, en une phrase." },
            keys: {
              type: "array",
              description: "Clés des sources et notes qui parlent de ce projet, recopiées telles quelles. Chaque clé dans un seul projet.",
              items: { type: "string" },
            },
          },
          required: ["name", "description", "keys"],
        },
      },
    },
    required: ["activityType", "targetAudience", "subjects"],
  },
};

const SYSTEM_PROMPT = `Tu lis la matière de travail d'une personne (dépôts de code, pages Notion, projets Linear, notes) pour comprendre ce qu'elle fait, avant qu'elle ne commence à publier sur ce qu'elle construit.

Règles :
- N'invente rien : décris uniquement ce que la matière montre. Mieux vaut une phrase simple et juste qu'une phrase brillante et fausse.
- Écris en français, à la deuxième personne (« tu »), sans jargon marketing.
- Regroupe en un même projet les sources qui parlent du même produit, même si elles viennent d'outils différents : c'est le croisement du code, de la réflexion et des tâches qui fera de bons posts.
- Au plus 5 projets. Si les sources sont plus nombreuses, regroupe les plus proches.
- Toutes les clés fournies doivent apparaître, chacune dans un seul projet. Les notes vont dans le projet dont elles parlent.`;

export function buildExtractionMessage(input: ProfileExtractionInput): string {
  const lines: string[] = [`Nom : ${input.name || "(non renseigné)"}`];
  for (const identity of input.identities) {
    const parts = [`Compte ${identity.provider} : ${identity.login}`];
    if (identity.name) parts.push(`nom affiché « ${identity.name} »`);
    if (identity.bio) parts.push(`bio « ${identity.bio} »`);
    lines.push(parts.join(", "));
  }
  lines.push("", "=== SOURCES ===");
  for (const item of input.items) {
    lines.push(`--- [${item.key}] ${item.kind} · ${item.label} ---`, item.excerpt || "(vide)", "");
  }
  return lines.join("\n");
}

/**
 * Remet la réponse du modèle d'aplomb : clés inconnues écartées, chaque clé dans un seul sujet, et
 * toute clé oubliée rangée quelque part — une source ne doit jamais disparaître de l'écran parce que
 * le modèle l'a omise. Une note oubliée rejoint le premier sujet ; une source oubliée forme le sien.
 */
export function normalizeSubjects(
  subjects: ExtractedSubject[],
  items: Array<{ key: string; label: string }>
): ExtractedSubject[] {
  const known = new Set(items.map((item) => item.key));
  const placed = new Set<string>();
  const result: ExtractedSubject[] = [];
  for (const subject of subjects) {
    const keys = subject.keys.filter((key) => known.has(key) && !placed.has(key));
    keys.forEach((key) => placed.add(key));
    if (keys.length > 0) result.push({ name: subject.name.trim(), description: subject.description.trim(), keys });
  }
  for (const item of items) {
    if (placed.has(item.key)) continue;
    if (item.key.startsWith("note:") && result.length > 0) {
      result[0].keys.push(item.key);
    } else {
      result.push({ name: item.label, description: "", keys: [item.key] });
    }
    placed.add(item.key);
  }
  return result;
}

export async function extractProfileFromMaterial(input: ProfileExtractionInput): Promise<ExtractedProfile> {
  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: buildExtractionMessage(input),
    tool: describeAuthorTool,
    maxTokens: 1500,
  });
  const parsed = extractedProfileSchema.parse(args);
  return {
    activityType: parsed.activityType.trim(),
    targetAudience: parsed.targetAudience.trim(),
    subjects: normalizeSubjects(parsed.subjects, input.items),
  };
}
