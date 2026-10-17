import { describe, expect, it } from "vitest";
import { buildBucketKey, computeWindowStart, pseudonymizeIdentifier, resolveRateLimitStatus } from "./rateLimitService";

describe("pseudonymizeIdentifier", () => {
  it("replaces the email with a stable fingerprint that does not contain the address", () => {
    const a = pseudonymizeIdentifier("alix@example.com");
    expect(a).toBe(pseudonymizeIdentifier("alix@example.com"));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("@");
    expect(pseudonymizeIdentifier("autre@example.com")).not.toBe(a);
  });
});

describe("computeWindowStart", () => {
  it("rounds down to the start of the nearest fixed window (multiple of windowMs)", () => {
    const windowSeconds = 60;
    expect(computeWindowStart(0, windowSeconds)).toBe(0);
    expect(computeWindowStart(59_999, windowSeconds)).toBe(0);
    expect(computeWindowStart(60_000, windowSeconds)).toBe(60_000);
    expect(computeWindowStart(125_000, windowSeconds)).toBe(120_000);
  });
});

describe("buildBucketKey", () => {
  it("composes scope, identifier and window start unambiguously", () => {
    expect(buildBucketKey("login", "203.0.113.4", 60_000)).toBe("login:203.0.113.4:60000");
  });
});

describe("resolveRateLimitStatus", () => {
  it("allows as long as the counter is less than or equal to the limit", () => {
    expect(resolveRateLimitStatus(1, 5).allowed).toBe(true);
    expect(resolveRateLimitStatus(5, 5).allowed).toBe(true);
  });

  it("blocks on the first excess", () => {
    expect(resolveRateLimitStatus(6, 5).allowed).toBe(false);
  });
});
