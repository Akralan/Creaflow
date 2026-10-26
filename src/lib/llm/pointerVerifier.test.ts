import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildVerifierMessage, verifyPostSources } from "./pointerVerifier";

const facts = [
  { id: "a", address: "docs/DEVLOG.md:9", text: "La veille d'inspiration disparaît" },
  { id: "b", address: "docs/DEVLOG.md:15", text: "On se connecte par un lien" },
];

beforeEach(() => callStructuredMock.mockReset());

describe("verifyPostSources", () => {
  it("ne garde que des ids de la liste, sans doublon", async () => {
    callStructuredMock.mockResolvedValue({ event_ids: ["a", "inconnu", "a"] });
    expect(await verifyPostSources("Post sur la veille.", facts)).toEqual(["a"]);
  });

  it("ne montre pas la déclaration du rédacteur : seulement le post et les faits", () => {
    const m = buildVerifierMessage("Le post.", facts);
    expect(m).toContain("[a] docs/DEVLOG.md:9 · La veille d'inspiration disparaît");
    expect(m).toContain("<post>\nLe post.\n</post>");
  });

  it("n'appelle pas le modèle sans fait", async () => {
    expect(await verifyPostSources("Post.", [])).toEqual([]);
    expect(callStructuredMock).not.toHaveBeenCalled();
  });
});
