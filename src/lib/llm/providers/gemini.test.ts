import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
  FunctionCallingConfigMode: { ANY: "ANY" },
}));

import { callGemini } from "./gemini";
import type { StructuredCallParams } from "../types";

const tool: StructuredCallParams["tool"] = {
  name: "test_tool",
  description: "desc",
  input_schema: { type: "object", properties: { foo: { type: "string" } }, required: ["foo"] },
};

const params: StructuredCallParams = {
  system: "system prompt",
  userMessage: "user message",
  tool,
  maxTokens: 512,
};

beforeEach(() => {
  generateContentMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("callGemini", () => {
  it("force l'appel de fonction via toolConfig et renvoie les args", async () => {
    generateContentMock.mockResolvedValue({
      functionCalls: [{ name: "test_tool", args: { foo: "bar" } }],
    });

    const result = await callGemini(params);

    expect(result).toEqual({ foo: "bar" });
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          systemInstruction: "system prompt",
          maxOutputTokens: 512,
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: ["test_tool"],
            },
          },
        }),
      })
    );
  });

  it("lève une erreur générique si aucun functionCall n'est renvoyé", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: undefined });
    await expect(callGemini(params)).rejects.toThrow("n'a pas renvoyé de réponse structurée");
  });
});
