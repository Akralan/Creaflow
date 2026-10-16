import { describe, expect, it, vi } from "vitest";

// Le service tire `db` à l'import ; on ne teste ici que les fonctions pures (jeton, hash, URL).
vi.mock("@/db", () => ({ db: {} }));

const { buildResetUrl, generateResetToken, hashResetToken } = await import("./passwordService");

describe("generateResetToken", () => {
  it("produit un jeton long, sûr dans une URL, différent à chaque appel", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashResetToken", () => {
  it("est déterministe et ne laisse pas deviner le jeton", () => {
    const token = "jeton-de-test";
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    expect(hashResetToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(token)).not.toContain(token);
  });
});

describe("buildResetUrl", () => {
  it("compose le lien sur APP_URL, avec ou sans slash final, en encodant le jeton", () => {
    expect(buildResetUrl("https://app.example/", "ab_c")).toBe("https://app.example/reinitialiser-mot-de-passe?token=ab_c");
    expect(buildResetUrl("https://app.example", "a+b")).toBe("https://app.example/reinitialiser-mot-de-passe?token=a%2Bb");
  });
});
