import { describe, expect, it } from "vitest";
import { getVertical } from "./registry";
import type { OnboardingStepContext, VerticalId } from "./types";
import { MIN_PRODUCTS } from "@/lib/validation";

const VERTICALS: VerticalId[] = ["creator", "dev"];

function context(overrides: Partial<OnboardingStepContext> = {}): OnboardingStepContext {
  return {
    advance: () => {},
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
    expect(getVertical("artisan" as VerticalId).id).toBe("creator");
  });

  it("donne au dev les projets avant la discussion — la discussion se nourrit des dépôts lus", () => {
    expect(getVertical("dev").onboarding.map((s) => s.id)).toEqual(["repos", "chat", "connections"]);
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
