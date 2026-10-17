import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateContentMock } = vi.hoisted(() => ({ generateContentMock: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { generateContent: generateContentMock } };
  }),
  FunctionCallingConfigMode: { ANY: "ANY" },
}));

import { captionImage } from "./geminiImage";
import type { LlmToolDefinition } from "../types";

const tool: LlmToolDefinition = {
  name: "caption_brand_asset",
  description: "desc",
  input_schema: { type: "object", properties: { description: { type: "string" } }, required: ["description"] },
};

beforeEach(() => {
  generateContentMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("captionImage", () => {
  it("renvoie les arguments du function call", async () => {
    generateContentMock.mockResolvedValue({
      functionCalls: [{ name: "caption_brand_asset", args: { description: "Une bougie" } }],
    });

    const result = await captionImage(Buffer.from("fake-bytes"), "image/jpeg", "system prompt", tool);

    expect(result).toEqual({ description: "Une bougie" });
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          expect.objectContaining({
            role: "user",
            parts: [
              { text: "system prompt" },
              { inlineData: { mimeType: "image/jpeg", data: Buffer.from("fake-bytes").toString("base64") } },
            ],
          }),
        ],
      })
    );
  });

  it("lève une erreur si aucun function call n'est renvoyé", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: undefined });
    await expect(captionImage(Buffer.from("x"), "image/jpeg", "system", tool)).rejects.toThrow(
      "did not return a structured caption"
    );
  });
});
