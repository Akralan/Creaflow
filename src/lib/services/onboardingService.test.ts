import { describe, expect, it } from "vitest";
import { planSubjectGrouping } from "./onboardingService";
import { llmFailureMessage } from "@/lib/llm/errors";

const sources = [
  { id: "gh", productId: "p-gh" },
  { id: "notion", productId: "p-notion" },
  { id: "linear", productId: "p-linear" },
];

describe("planSubjectGrouping", () => {
  it("réunit trois sources sur le sujet de la première et libère les deux autres", () => {
    const { plan, orphanedProductIds } = planSubjectGrouping(
      [{ keys: ["source:gh", "source:notion", "source:linear", "note:n1"] }],
      sources,
      ["n1"]
    );
    expect(plan).toEqual([{ sourceIds: ["gh", "notion", "linear"], noteIds: ["n1"], targetProductId: "p-gh" }]);
    expect(orphanedProductIds).toEqual(["p-notion", "p-linear"]);
  });

  it("garde un sujet par source quand rien ne se recoupe", () => {
    const { plan, orphanedProductIds } = planSubjectGrouping(
      [{ keys: ["source:gh"] }, { keys: ["source:notion"] }],
      sources.slice(0, 2),
      []
    );
    expect(plan.map((g) => g.targetProductId)).toEqual(["p-gh", "p-notion"]);
    expect(orphanedProductIds).toEqual([]);
  });

  it("creates a new subject for a group made only of notes", () => {
    const { plan } = planSubjectGrouping([{ keys: ["note:n1"] }], [], ["n1"]);
    expect(plan).toEqual([{ sourceIds: [], noteIds: ["n1"], targetProductId: null }]);
  });

  it("rejects a source filed under two subjects", () => {
    expect(() => planSubjectGrouping([{ keys: ["source:gh"] }, { keys: ["source:gh"] }], sources, [])).toThrow(
      "two subjects"
    );
  });

  it("rejects a source left outside every subject", () => {
    expect(() => planSubjectGrouping([{ keys: ["source:gh"] }], sources.slice(0, 2), [])).toThrow("belong");
  });

  it("rejects a key that does not belong to the user", () => {
    expect(() => planSubjectGrouping([{ keys: ["source:etranger"] }], sources, [])).toThrow("Unknown");
  });
});

describe("llmFailureMessage", () => {
  it("dit clairement qu'il n'y a plus de crédits OpenAI", () => {
    const error = new Error("429 You have no credits remaining. Add credits to continue using the API.");
    expect(llmFailureMessage(error)).toMatch(/credits/i);
  });

  it("distingue une clé absente ou invalide", () => {
    expect(llmFailureMessage(new Error("401 Incorrect API key provided"))).toMatch(/OpenAI/);
  });

  it("distingue une saturation passagère", () => {
    expect(llmFailureMessage(new Error("429 Rate limit reached for requests"))).toMatch(/busy|overloaded|try again/i);
  });

  it("retombe sur un message générique", () => {
    expect(llmFailureMessage(new Error("socket hang up"))).not.toMatch(/credits|OpenAI|busy|overloaded/i);
  });
});
