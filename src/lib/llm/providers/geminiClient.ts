import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

// Singleton shared by callGemini (structured text), geminiImage (vision captioning) and
// embeddings — un seul client GoogleGenAI pour toute la surface Gemini du repo.
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
