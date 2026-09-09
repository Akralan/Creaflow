import { describe, expect, it } from "vitest";
import { getVertical } from "./registry";
import type { OnboardingStepContext, VerticalId } from "./types";
import { MIN_PRODUCTS } from "@/lib/validation";

const VERTICALS: VerticalId[] = ["creator", "dev", "artisan", "entrepreneur"];

function context(overrides: Partial<OnboardingStepContext> = {}): OnboardingStepContext {
  return {
    advance: () => {},
    connectedProvider: null,
    connections: [],
    productCount: 0,
    onProductCountChange: () => {},
    ...overrides,
  };
}

describe.each(VERTICALS)("invariants du parcours %s", (id) => {
  const steps = getVertical(id).onboarding;

  it("déclare au moins une étape", () => {
    expect(steps.length).toBeGreaterThan(0);
  });

  it("n'a pas deux étapes du même id — la page les utilise comme clés React", () => {
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it("ne termine pas sur une étape auto-portée, sinon « Terminer et ouvrir l'app » ne s'afficherait jamais", () => {
    expect(steps[steps.length - 1].selfAdvancing).toBeFalsy();
  });

  it("ne met pas de validate sur une étape auto-portée : la page ne l'appelle que depuis « Continuer », il serait ignoré", () => {
    for (const step of steps.filter((s) => s.selfAdvancing)) {
      expect(step.validate, `étape ${step.id}`).toBeUndefined();
    }
  });
});

describe("getVertical", () => {
  it("retombe sur le parcours créateur pour une valeur inconnue, plutôt que de rendre une page vide", () => {
    expect(getVertical("pâtissier" as VerticalId).id).toBe("creator");
  });

  it("met les sujets avant la discussion — la discussion se nourrit de ce qui a été lu", () => {
    expect(getVertical("dev").onboarding.map((s) => s.id)).toEqual(["sources", "chat", "connections"]);
  });

  it("donne le même parcours aux trois verticales nées d'un fournisseur tiers", () => {
    // Elles ne diffèrent aujourd'hui que par leur nom (SPEC_CONNECTEURS_ET_SUJETS.md §7.2) : si ce
    // test casse, c'est qu'une différenciation a été introduite — délibérément ou par accident.
    const ids = (v: VerticalId) => getVertical(v).onboarding.map((s) => s.id);
    expect(ids("artisan")).toEqual(ids("dev"));
    expect(ids("entrepreneur")).toEqual(ids("dev"));
  });
});

describe("parcours créateur — garde sur les sujets", () => {
  const subjects = getVertical("creator").onboarding.find((s) => s.id === "subjects")!;

  it("bloque tant que le minimum de sujets n'est pas atteint", () => {
    expect(subjects.validate?.(context({ productCount: MIN_PRODUCTS - 1 }))).toMatch(/au moins/);
  });

  it("laisse passer au minimum requis", () => {
    expect(subjects.validate?.(context({ productCount: MIN_PRODUCTS }))).toBeNull();
  });
});
