import { describe, expect, it } from "vitest";
import { buildBucketKey, computeWindowStart, resolveRateLimitStatus } from "./rateLimitService";

describe("computeWindowStart", () => {
  it("arrondit au début de la fenêtre fixe la plus proche (multiple du windowMs)", () => {
    const windowSeconds = 60;
    expect(computeWindowStart(0, windowSeconds)).toBe(0);
    expect(computeWindowStart(59_999, windowSeconds)).toBe(0);
    expect(computeWindowStart(60_000, windowSeconds)).toBe(60_000);
    expect(computeWindowStart(125_000, windowSeconds)).toBe(120_000);
  });
});

describe("buildBucketKey", () => {
  it("compose scope, identifiant et début de fenêtre sans ambiguïté", () => {
    expect(buildBucketKey("login", "203.0.113.4", 60_000)).toBe("login:203.0.113.4:60000");
  });
});

describe("resolveRateLimitStatus", () => {
  it("autorise tant que le compteur est inférieur ou égal à la limite", () => {
    expect(resolveRateLimitStatus(1, 5).allowed).toBe(true);
    expect(resolveRateLimitStatus(5, 5).allowed).toBe(true);
  });

  it("bloque au premier dépassement", () => {
    expect(resolveRateLimitStatus(6, 5).allowed).toBe(false);
  });
});
