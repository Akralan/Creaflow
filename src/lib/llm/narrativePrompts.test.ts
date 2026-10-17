import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { chooseDailyDirection, type DailyDirectionContext } from "./narrativePrompts";

const context: DailyDirectionContext = {
  brandName: "Alix",
  activityType: "Tu construis un jeu",
  subjectLabel: "Mira",
  mode: "rendez_vous",
  platform: "x",
  contentCategoryLabel: "Coulisses",
  contentCategoryDescription: "Le travail en cours",
  contentType: "text",
  openPromiseTexts: [],
  callbacks: [],
  documents: [],
};

const answer = {
  beatId: "",
  concept: "Le saut réglé, montré aux joueurs.",
  kind: "material",
  focusDocIds: [],
  callbackToUse: "",
  promiseToHonor: "",
  promiseToMake: "",
  angleHint: "",
};

beforeEach(() => callStructuredMock.mockReset());

describe("chooseDailyDirection — public visé (docs/SPEC_PROMPT_GENERATION_V3.md §2.3)", () => {
  it("propose les publics du portrait en enum et rappelle les publics récents", async () => {
    callStructuredMock.mockResolvedValue({ ...answer, readerLabel: "Joueurs" });
    const result = await chooseDailyDirection({
      ...context,
      readers: [
        { label: "Joueurs", who: "Fans de plateformes" },
        { label: "Devs indés", who: "Développeurs de jeux" },
      ],
      recentReaderLabels: ["Devs indés"],
    });
    const call = callStructuredMock.mock.calls[0][0];
    expect(call.userMessage).toContain("Publics de ce sujet : Joueurs (Fans de plateformes) ; Devs indés (Développeurs de jeux)");
    expect(call.userMessage).toContain("Publics visés par les derniers posts : Devs indés");
    expect(call.userMessage).toContain("rôle \"Coulisses\"");
    expect(call.tool.input_schema.properties.readerLabel.enum).toEqual(["Joueurs", "Devs indés", ""]);
    expect(call.tool.input_schema.required).toContain("readerLabel");
    expect(result.readerLabel).toBe("Joueurs");
  });

  it("sans portrait, ni publics dans le message ni enum, et readerLabel null", async () => {
    callStructuredMock.mockResolvedValue({ ...answer, readerLabel: "" });
    const result = await chooseDailyDirection(context);
    const call = callStructuredMock.mock.calls[0][0];
    expect(call.userMessage).not.toContain("Publics de ce sujet");
    expect(call.tool.input_schema.properties.readerLabel.enum).toBeUndefined();
    expect(result.readerLabel).toBeNull();
  });
});
