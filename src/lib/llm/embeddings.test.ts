import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function OpenAIMock() {
    return { embeddings: { create: createMock } };
  }),
}));

import { embedText } from "./embeddings";

beforeEach(() => {
  createMock.mockReset();
  process.env.OPENAI_API_KEY = "test-key";
});

describe("embedText", () => {
  it("renvoie le vecteur du premier embedding", async () => {
    createMock.mockResolvedValue({ data: [{ embedding: [0.1, 0.2, 0.3] }] });

    const result = await embedText("Bougie ambrée, ambiance chaleureuse");

    expect(result).toEqual([0.1, 0.2, 0.3]);
    // `dimensions` explicite : le défaut de text-embedding-3-small est 1536, ce qui ne rentrerait
    // pas dans brandAssets.embedding (vector(768)).
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ input: "Bougie ambrée, ambiance chaleureuse", dimensions: 768 })
    );
  });

  it("lève une erreur si aucun embedding n'est renvoyé", async () => {
    createMock.mockResolvedValue({ data: [] });
    await expect(embedText("texte")).rejects.toThrow("Aucun embedding renvoyé");
  });
});
