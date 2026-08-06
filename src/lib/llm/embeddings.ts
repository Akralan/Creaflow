import { getGeminiClient } from "./providers/geminiClient";

// Dimension fixe, cohérente avec brandAssets.embedding (vector(768), src/db/schema.ts).
const DIMENSIONS = 768;
const MODEL = process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";

export async function embedText(text: string): Promise<number[]> {
  const response = await getGeminiClient().models.embedContent({
    model: MODEL,
    contents: text,
    config: { outputDimensionality: DIMENSIONS },
  });

  const values = response.embeddings?.[0]?.values;
  if (!values) {
    throw new Error("Aucun embedding renvoyé par le modèle.");
  }
  return values;
}
