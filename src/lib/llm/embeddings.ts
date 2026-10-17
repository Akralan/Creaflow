import { getOpenAIClient } from "./providers/openaiClient";

// Fixed dimension, consistent with brandAssets.embedding (vector(768), src/db/schema.ts).
const DIMENSIONS = 768;

/**
 * Embeddings via OpenAI, regardless of `LLM_PROVIDER` — same stance as the assistant's agentic
 * loop (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2): `LLM_PROVIDER` drives content generation, not
 * all of the product's capabilities.
 *
 * Replaces Gemini `text-embedding-004`, retired on Google's side: the call returned
 * `404 models/text-embedding-004 is not found for API version v1beta`, which broke all
 * visual content generation (docs/SPEC_RESSOURCES_VISUELLES.md §8.4).
 *
 * `dimensions: 768` is explicit: the default of text-embedding-3-small is 1536, which would make
 * insertion into `vector(768)` fail. This parameter natively truncates the vector, without
 * schema migration or reindexing.
 */
export async function embedText(text: string): Promise<number[]> {
  const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const response = await getOpenAIClient().embeddings.create({
    model,
    input: text,
    dimensions: DIMENSIONS,
  });

  const values = response.data?.[0]?.embedding;
  if (!values) {
    throw new Error("No embedding returned by the model.");
  }
  return values;
}
