import { z } from "zod";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { getClaudeClient, CLAUDE_MODEL } from "./client";

export const styleProfileSchema = z.object({
  tone: z.string().min(1),
  sentenceLength: z.string().min(1),
  emojiUsage: z.string().min(1),
  vocabulary: z.string().min(1),
  summary: z.string().min(1),
});

export type StyleProfile = z.infer<typeof styleProfileSchema>;

const ANALYZE_STYLE_TOOL_NAME = "analyze_style";

const analyzeStyleTool: Tool = {
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
  const client = getClaudeClient();

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [analyzeStyleTool],
    tool_choice: { type: "tool", name: ANALYZE_STYLE_TOOL_NAME },
    messages: [
      {
        role: "user",
        content: `Légendes à analyser :\n${captions.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );

  if (!toolUse) {
    throw new Error("Claude n'a pas renvoyé d'analyse de style structurée.");
  }

  return styleProfileSchema.parse(toolUse.input);
}
