import { describe, expect, it, vi } from "vitest";

// The service pulls in `db`, Stripe and storage at import; only the pure logic is tested here.
vi.mock("@/db", () => ({ db: {} }));

const { matchesEmailConfirmation } = await import("./accountService");

describe("matchesEmailConfirmation", () => {
  it("accepts the account address, regardless of case and whitespace", () => {
    expect(matchesEmailConfirmation("alix@example.com", "  Alix@Example.com ")).toBe(true);
  });

  it("rejects a different or missing address", () => {
    expect(matchesEmailConfirmation("alix@example.com", "autre@example.com")).toBe(false);
    expect(matchesEmailConfirmation("alix@example.com", undefined)).toBe(false);
    expect(matchesEmailConfirmation("alix@example.com", "")).toBe(false);
  });
});
