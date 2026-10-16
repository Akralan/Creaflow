import { describe, expect, it } from "vitest";
import { buildBucketKey, computeWindowStart, pseudonymizeIdentifier, resolveRateLimitStatus } from "./rateLimitService";

describe("pseudonymizeIdentifier", () => {
  it("remplace l'email par une empreinte stable qui ne contient pas l'adresse", () => {
    const a = pseudonymizeIdentifier("alix@example.com");
    expect(a).toBe(pseudonymizeIdentifier("alix@example.com"));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("@");
    expect(pseudonymizeIdentifier("autre@example.com")).not.toBe(a);
  });
});

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
