import OpenAI from "openai";

let client: OpenAI | null = null;

// Singleton partagé par callOpenAI (texte structuré), callOpenAIAgentic (boucle de l'assistant) et
// embeddings — même pattern que geminiClient pour toute la surface Gemini du repo.
export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY n'est pas défini dans l'environnement.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}
