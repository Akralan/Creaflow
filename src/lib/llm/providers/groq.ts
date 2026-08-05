import Groq from "groq-sdk";
import type { StructuredCallParams } from "../types";

let client: Groq | null = null;

function getClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY n'est pas défini dans l'environnement.");
    }
    client = new Groq({ apiKey });
  }
  return client;
}

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export async function callGroq({ system, userMessage, tool, maxTokens }: StructuredCallParams): Promise<unknown> {
  const response = await getClient().chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: tool.name } },
  });

  const call = response.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") {
    throw new Error("Le modèle n'a pas renvoyé de réponse structurée.");
  }

  return JSON.parse(call.function.arguments);
}
