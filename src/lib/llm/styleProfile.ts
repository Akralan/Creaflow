import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

export const styleProfileSchema = z.object({
  tone: z.string().min(1),
  sentenceLength: z.string().min(1),
  emojiUsage: z.string().min(1),
  vocabulary: z.string().min(1),
  summary: z.string().min(1),
});

export type StyleProfile = z.infer<typeof styleProfileSchema>;

const ANALYZE_STYLE_TOOL_NAME = "analyze_style";

const analyzeStyleTool: LlmToolDefinition = {
  name: ANALYZE_STYLE_TOOL_NAME,
  description: "Renvoie un résumé structuré du style de communication observé dans des légendes de vidéos.",
  input_schema: {
    type: "object",
    properties: {
      tone: { type: "string", description: "Ton général (ex: humoristique, direct, chaleureux)." },
      sentenceLength: { type: "string", description: "Longueur et structure de phrase typiques." },
      emojiUsage: { type: "string", description: "Usage des emojis (fréquence, type)." },
      vocabulary: { type: "string", description: "Registre de vocabulaire utilisé." },
      summary: {
        type: "string",
        description: "Résumé en 2-3 phrases, directement injectable comme consigne de style pour une future génération.",
      },
    },
    required: ["tone", "sentenceLength", "emojiUsage", "vocabulary", "summary"],
  },
};

const SYSTEM_PROMPT =
  "Tu analyses des légendes de vidéos publiées par un créateur de contenu pour en extraire un résumé de style de communication, réutilisable comme consigne de ton pour générer de futurs contenus cohérents.";

export async function analyzeStyle(captions: string[]): Promise<StyleProfile> {
  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: `Légendes à analyser :\n${captions.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
    tool: analyzeStyleTool,
    maxTokens: 1024,
  });

  return styleProfileSchema.parse(args);
}
