import { describe, expect, it } from "vitest";
import { isSessionInvalidated } from "./session";

describe("isSessionInvalidated", () => {
  it("laisse passer tout jeton tant qu'aucun reset n'a eu lieu", () => {
    expect(isSessionInvalidated(1_000_000, null)).toBe(false);
  });

  it("rejects a token issued before the reset, accepts one issued in the same second or after", () => {
    const reset = new Date(1_000_000_500); // 1 000 000,5 s
    expect(isSessionInvalidated(999_999, reset)).toBe(true);
    // The token set right after the reset is issued at second 1,000,000 (rounded iat): it must
    // stay valid, otherwise the user would be logged out right after their own reset.
    expect(isSessionInvalidated(1_000_000, reset)).toBe(false);
    expect(isSessionInvalidated(1_000_001, reset)).toBe(false);
  });
});
