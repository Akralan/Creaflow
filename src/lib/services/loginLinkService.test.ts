import { describe, expect, it } from "vitest";
import { buildLoginUrl, generateLoginToken, hashLoginToken } from "./loginLinkService";

describe("loginLinkService", () => {
  it("génère des jetons distincts, sûrs dans une URL", () => {
    const a = generateLoginToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateLoginToken()).not.toBe(a);
  });

  it("ne stocke que le hash, stable et différent du jeton", () => {
    const token = generateLoginToken();
    expect(hashLoginToken(token)).toBe(hashLoginToken(token));
    expect(hashLoginToken(token)).not.toContain(token);
  });

  it("construit l'URL sans double barre", () => {
    expect(buildLoginUrl("https://x.test/", "abc")).toBe("https://x.test/connexion/lien?token=abc");
  });
});
