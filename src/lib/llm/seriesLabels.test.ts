import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));

vi.mock("./provider", () => ({
  callStructured: callStructuredMock,
}));

import { suggestContentSeries, seriesEntrySchema } from "./seriesLabels";
import { seriesProposalSchema } from "./assistantChat";

// docs/SPEC_SERIES_ET_ROLES.md §1 — une série porte exactement un rôle : le contrat LLM renvoie
// un `categoryLabel` unique, jamais une liste.

const context = {
  brandName: "Studio Test",
  activityType: "Freelance produit web",
  products: [],
  categories: [
    { label: "Coulisses", description: "Ce qui se passe derrière." },
    { label: "Expertise", description: "Ce qu'on apprend." },
  ],
};

describe("suggestContentSeries", () => {
  beforeEach(() => {
    callStructuredMock.mockReset();
  });

  it("accepte une série avec un rôle unique et transmet l'enum des rôles à l'outil", async () => {
    callStructuredMock.mockResolvedValue({
      series: [{ label: "Build in public", description: "Chaque semaine, l'avancement.", weight: 20, categoryLabel: "Coulisses", mode: "feuilleton" }],
    });

    const result = await suggestContentSeries(context);

    expect(result).toEqual([
      { label: "Build in public", description: "Chaque semaine, l'avancement.", weight: 20, categoryLabel: "Coulisses", mode: "feuilleton" },
    ]);
    const tool = callStructuredMock.mock.calls[0][0].tool;
    const categoryField = tool.input_schema.properties.series.items.properties.categoryLabel;
    expect(categoryField.type).toBe("string");
    expect(categoryField.enum).toEqual(["Coulisses", "Expertise"]);
    expect(tool.input_schema.properties.series.items.required).toContain("categoryLabel");
    expect(tool.input_schema.properties.series.items.properties.categoryLabels).toBeUndefined();
  });

  it("rejette une réponse qui renvoie encore une liste de rôles", async () => {
    callStructuredMock.mockResolvedValue({
      series: [{ label: "X", description: "Y", weight: 10, categoryLabels: ["Coulisses", "Expertise"], mode: "rendez_vous" }],
    });

    await expect(suggestContentSeries(context)).rejects.toThrow();
  });

  it("le system prompt impose un seul rôle par série", async () => {
    callStructuredMock.mockResolvedValue({ series: [] });
    await suggestContentSeries(context);
    const system: string = callStructuredMock.mock.calls[0][0].system;
    expect(system).toMatch(/UN SEUL rôle/);
    expect(system).toMatch(/deux séries/);
  });
});

describe("schémas d'entrée série (rôle unique)", () => {
  it("seriesEntrySchema exige categoryLabel", () => {
    expect(seriesEntrySchema.safeParse({ label: "A", description: "B", weight: 10, mode: "rendez_vous" }).success).toBe(false);
    expect(seriesEntrySchema.safeParse({ label: "A", description: "B", weight: 10, mode: "rendez_vous", categoryLabel: "Coulisses" }).success).toBe(true);
  });

  it("seriesProposalSchema (assistant) exige categoryLabel et refuse categoryLabels", () => {
    const base = { action: "create", label: "A", description: "B", weight: 10, platforms: [] };
    expect(seriesProposalSchema.safeParse({ ...base, categoryLabels: ["Coulisses"] }).success).toBe(false);
    expect(seriesProposalSchema.safeParse({ ...base, categoryLabel: "Coulisses" }).success).toBe(true);
  });
});
