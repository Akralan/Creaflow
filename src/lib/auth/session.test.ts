import { describe, expect, it } from "vitest";
import { isSessionInvalidated } from "./session";

describe("isSessionInvalidated", () => {
  it("laisse passer tout jeton tant qu'aucun reset n'a eu lieu", () => {
    expect(isSessionInvalidated(1_000_000, null)).toBe(false);
  });

  it("refuse un jeton émis avant le reset, accepte celui émis dans la même seconde ou après", () => {
    const reset = new Date(1_000_000_500); // 1 000 000,5 s
    expect(isSessionInvalidated(999_999, reset)).toBe(true);
    // Le jeton posé juste après le reset est émis à la seconde 1 000 000 (iat arrondi) : il doit
    // rester valide, sinon l'utilisateur serait déconnecté dans la foulée de son propre reset.
    expect(isSessionInvalidated(1_000_000, reset)).toBe(false);
    expect(isSessionInvalidated(1_000_001, reset)).toBe(false);
  });
});
