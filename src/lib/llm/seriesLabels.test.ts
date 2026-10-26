import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { suggestContentSeries, seriesEntrySchema } from "./seriesLabels";

// docs/SPEC_SERIES_ET_ROLES.md §1 — une série porte exactement un rôle : le contrat LLM renvoie
// un `categoryLabel` unique, jamais une liste.

const context = {
  brandName: "Studio Test",
  activityType: "Freelance produit web",
  products: [],
  categories: [
    { label: "Behind the scenes", description: "What happens behind." },
    { label: "Expertise", description: "Ce qu'on apprend." },
  ],
};

describe("suggestContentSeries", () => {
  beforeEach(() => {
    callStructuredMock.mockReset();
  });

  it("accepte une série avec un rôle unique et transmet l'enum des rôles à l'outil", async () => {
    callStructuredMock.mockResolvedValue({
      series: [{ label: "Build in public", description: "Chaque semaine, l'avancement.", categoryLabel: "Behind the scenes" }],
    });

    const result = await suggestContentSeries(context);

    expect(result).toEqual([
      { label: "Build in public", description: "Chaque semaine, l'avancement.", categoryLabel: "Behind the scenes", subjectName: "" },
    ]);
    const tool = callStructuredMock.mock.calls[0][0].tool;
    // Le sujet est choisi parmi ceux du compte (rattachement de la matière, 2026-10-17).
    expect(tool.input_schema.properties.series.items.properties.subjectName.enum).toEqual([""]);
    expect(tool.input_schema.properties.series.items.required).toContain("subjectName");
    const categoryField = tool.input_schema.properties.series.items.properties.categoryLabel;
    expect(categoryField.type).toBe("string");
    expect(categoryField.enum).toEqual(["Behind the scenes", "Expertise"]);
    expect(tool.input_schema.properties.series.items.required).toContain("categoryLabel");
    expect(tool.input_schema.properties.series.items.properties.categoryLabels).toBeUndefined();
  });

  it("rejette une réponse qui renvoie encore une liste de rôles", async () => {
    callStructuredMock.mockResolvedValue({
      series: [{ label: "X", description: "Y", weight: 10, categoryLabels: ["Behind the scenes", "Expertise"] }],
    });

    await expect(suggestContentSeries(context)).rejects.toThrow();
  });

  it("le system prompt impose un seul rôle par série", async () => {
    callStructuredMock.mockResolvedValue({ series: [] });
    await suggestContentSeries(context);
    const system: string = callStructuredMock.mock.calls[0][0].system;
    expect(system).toMatch(/ONE SINGLE editorial role/);
    expect(system).toMatch(/two series/);
  });
});

describe("schémas d'entrée série (rôle unique)", () => {
  it("seriesEntrySchema exige categoryLabel", () => {
    expect(seriesEntrySchema.safeParse({ label: "A", description: "B", weight: 10 }).success).toBe(false);
    expect(seriesEntrySchema.safeParse({ label: "A", description: "B", weight: 10, categoryLabel: "Behind the scenes" }).success).toBe(true);
  });
});
