import { describe, expect, it, vi } from "vitest";

// Le service tire `db`, Stripe et le stockage à l'import ; seule la logique pure est testée ici.
vi.mock("@/db", () => ({ db: {} }));

const { matchesEmailConfirmation } = await import("./accountService");

describe("matchesEmailConfirmation", () => {
  it("accepte l'adresse du compte, indifféremment à la casse et aux espaces", () => {
    expect(matchesEmailConfirmation("alix@example.com", "  Alix@Example.com ")).toBe(true);
  });

  it("refuse une adresse différente ou absente", () => {
    expect(matchesEmailConfirmation("alix@example.com", "autre@example.com")).toBe(false);
    expect(matchesEmailConfirmation("alix@example.com", undefined)).toBe(false);
    expect(matchesEmailConfirmation("alix@example.com", "")).toBe(false);
  });
});
