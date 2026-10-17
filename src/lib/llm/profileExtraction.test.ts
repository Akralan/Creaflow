import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildExtractionMessage, extractProfileFromMaterial, normalizeSubjects } from "./profileExtraction";

const items = [
  { key: "source:gh", kind: "GitHub", label: "akralan/creaflow", excerpt: "README de Buildloud" },
  { key: "source:notion", kind: "Notion", label: "Logbook", excerpt: "Product decisions" },
  { key: "source:linear", kind: "Linear", label: "Autre projet", excerpt: "Tâches" },
  { key: "note:n1", kind: "Pasted notes", label: "My notes", excerpt: "Ideas" },
];

beforeEach(() => callStructuredMock.mockReset());

describe("normalizeSubjects", () => {
  it("garde les regroupements du modèle", () => {
    const result = normalizeSubjects(
      [{ name: "Buildloud", description: "Tool", targetAudience: "Indie devs", keys: ["source:gh", "source:notion", "note:n1"] }, { name: "Autre", description: "", targetAudience: "", keys: ["source:linear"] }],
      items
    );
    expect(result).toEqual([
      { name: "Buildloud", description: "Tool", targetAudience: "Indie devs", keys: ["source:gh", "source:notion", "note:n1"] },
      { name: "Autre", description: "", targetAudience: "", keys: ["source:linear"] },
    ]);
  });

  it("écarte les clés inconnues et les doublons, et supprime un sujet devenu vide", () => {
    const result = normalizeSubjects(
      [
        { name: "A", description: "", targetAudience: "", keys: ["source:gh", "source:inventee"] },
        { name: "B", description: "", targetAudience: "", keys: ["source:gh"] },
      ],
      items.slice(0, 1)
    );
    expect(result).toEqual([{ name: "A", description: "", targetAudience: "", keys: ["source:gh"] }]);
  });

  it("range une source oubliée dans son propre sujet, une note oubliée dans le premier", () => {
    const result = normalizeSubjects([{ name: "Buildloud", description: "", targetAudience: "", keys: ["source:gh"] }], items);
    expect(result.map((s) => s.keys)).toEqual([["source:gh", "note:n1"], ["source:notion"], ["source:linear"]]);
    expect(result[1].name).toBe("Logbook");
  });

  it("fait un sujet de la note seule quand il n'y a rien d'autre", () => {
    expect(normalizeSubjects([], [items[3]])).toEqual([{ name: "My notes", description: "", targetAudience: "", keys: ["note:n1"] }]);
  });
});

describe("extractProfileFromMaterial", () => {
  it("transmet identité et matière, et normalise la réponse", async () => {
    callStructuredMock.mockResolvedValue({
      activityType: " You build Buildloud. ",
      targetAudience: "Developers",
      subjects: [{ name: "Buildloud", description: "Tool", targetAudience: "", keys: ["source:gh"] }],
    });
    const result = await extractProfileFromMaterial({
      name: "Alix",
      identities: [{ provider: "GitHub", login: "akralan", name: "Alix", bio: "I build tools" }],
      items: items.slice(0, 2),
    });
    const message: string = callStructuredMock.mock.calls[0][0].userMessage;
    expect(message).toContain("GitHub account: akralan, display name \"Alix\", bio \"I build tools\"");
    expect(message).toContain("--- [source:notion] Notion · Logbook ---");
    expect(result.activityType).toBe("You build Buildloud.");
    expect(result.subjects.map((s) => s.keys)).toEqual([["source:gh"], ["source:notion"]]);
  });
});

describe("buildExtractionMessage", () => {
  it("signale un nom absent plutôt que de laisser une ligne vide", () => {
    expect(buildExtractionMessage({ name: "", identities: [], items: [] })).toContain("Name: (not provided)");
  });
});
