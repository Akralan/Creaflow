import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

// Singleton partagé par callGemini (texte structuré), geminiImage (vision/génération d'image) et
// embeddings — un seul client GoogleGenAI pour toute la surface Gemini du repo.
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY n'est pas défini dans l'environnement.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
