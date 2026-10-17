import OpenAI from "openai";

let client: OpenAI | null = null;

// Singleton shared by callOpenAI (structured text), callOpenAIAgentic (the assistant's loop) and
// embeddings — same pattern as geminiClient for the whole Gemini surface of the repo.
export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in the environment.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}
