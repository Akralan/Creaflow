import { beforeEach, describe, expect, it, vi } from "vitest";

const { embedContentMock } = vi.hoisted(() => ({ embedContentMock: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { models: { embedContent: embedContentMock } };
  }),
}));

import { embedText } from "./embeddings";

beforeEach(() => {
  embedContentMock.mockReset();
  process.env.GEMINI_API_KEY = "test-key";
});

describe("embedText", () => {
  it("renvoie le vecteur du premier embedding", async () => {
    embedContentMock.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2, 0.3] }] });

    const result = await embedText("Bougie ambrée, ambiance chaleureuse");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    expect(embedContentMock).toHaveBeenCalledWith(
      expect.objectContaining({ contents: "Bougie ambrée, ambiance chaleureuse", config: { outputDimensionality: 768 } })
    );
  });

  it("lève une erreur si aucun embedding n'est renvoyé", async () => {
    embedContentMock.mockResolvedValue({ embeddings: [] });
    await expect(embedText("texte")).rejects.toThrow("Aucun embedding renvoyé");
  });
});
