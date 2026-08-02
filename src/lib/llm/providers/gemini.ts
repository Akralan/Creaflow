import { GoogleGenAI, FunctionCallingConfigMode } from "@google/genai";
import type { StructuredCallParams } from "../types";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY n'est pas défini dans l'environnement.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

export async function callGemini({ system, userMessage, tool, maxTokens }: StructuredCallParams): Promise<unknown> {
  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: userMessage,
    config: {
      systemInstruction: system,
      maxOutputTokens: maxTokens,
      tools: [
        {
          functionDeclarations: [
            {
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.input_schema,
            },
          ],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: [tool.name],
        },
      },
    },
  });

  const call = response.functionCalls?.[0];

  if (!call) {
    throw new Error("Le modèle n'a pas renvoyé de réponse structurée.");
  }

  return call.args;
}
