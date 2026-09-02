import { getOpenAIClient } from "./providers/openaiClient";

// Dimension fixe, cohérente avec brandAssets.embedding (vector(768), src/db/schema.ts).
const DIMENSIONS = 768;

/**
 * Embeddings via OpenAI, indépendamment de `LLM_PROVIDER` — même parti pris que la boucle agentique
 * de l'assistant (docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2) : `LLM_PROVIDER` pilote la génération de
 * contenu, pas toutes les capacités du produit.
 *
 * Remplace Gemini `text-embedding-004`, retiré côté Google : l'appel renvoyait
 * `404 models/text-embedding-004 is not found for API version v1beta`, ce qui cassait toute
 * génération de contenu visuel (docs/SPEC_RESSOURCES_VISUELLES.md §8.4).
 *
 * `dimensions: 768` est explicite : le défaut de text-embedding-3-small est 1536, ce qui ferait
 * échouer l'insertion dans `vector(768)`. Ce paramètre tronque nativement le vecteur, sans
 * migration de schéma ni réindexation.
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
    throw new Error("Aucun embedding renvoyé par le modèle.");
  }
  return values;
}
