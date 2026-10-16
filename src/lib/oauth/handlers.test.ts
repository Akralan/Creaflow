import { describe, expect, it, vi } from "vitest";

// handlers.ts importe la session et la base : seule la fonction pure nous intéresse ici.
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/services/onboardingService", () => ({ isOnboardingComplete: vi.fn() }));
vi.mock("@/lib/services/oauthAccountService", () => ({ resolveOAuthAccount: vi.fn() }));

import { safeReturnPath } from "./handlers";

describe("safeReturnPath", () => {
  it("accepte un chemin interne avec sa requête", () => {
    expect(safeReturnPath("/onboarding?step=sources")).toBe("/onboarding?step=sources");
  });

  it.each([
    ["https://evil.com"],
    ["//evil.com"],
    ["/\\evil.com"],
    ["/\t/evil.com"],
    ["/\n/evil.com"],
    ["/\r/evil.com"],
    ["onboarding"],
    [""],
  ])("refuse %j", (value) => {
    expect(safeReturnPath(value)).toBeNull();
  });

  it("refuse l'absence de valeur", () => {
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath(undefined)).toBeNull();
  });
});
