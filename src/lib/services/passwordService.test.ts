import { describe, expect, it, vi } from "vitest";

// The service pulls in `db` on import; here we only test the pure functions (token, hash, URL).
vi.mock("@/db", () => ({ db: {} }));

const { buildResetUrl, generateResetToken, hashResetToken } = await import("./passwordService");

describe("generateResetToken", () => {
  it("produces a long token, safe in a URL, different on each call", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});

describe("hashResetToken", () => {
  it("is deterministic and does not let the token be guessed", () => {
    const token = "jeton-de-test";
    expect(hashResetToken(token)).toBe(hashResetToken(token));
    expect(hashResetToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashResetToken(token)).not.toContain(token);
  });
});

describe("buildResetUrl", () => {
  it("builds the link on APP_URL, with or without a trailing slash, encoding the token", () => {
    expect(buildResetUrl("https://app.example/", "ab_c")).toBe("https://app.example/reinitialiser-mot-de-passe?token=ab_c");
    expect(buildResetUrl("https://app.example", "a+b")).toBe("https://app.example/reinitialiser-mot-de-passe?token=a%2Bb");
  });
});
