import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

// bcrypt est volontairement lent et occupe un cœur : sous la charge de la suite entière, les
// 5 s par défaut de Vitest ne suffisent plus. Le plafond est ici, pas en global, pour que le reste
// de la suite garde un délai court.
describe("password hashing", { timeout: 20_000 }, () => {
  it("hashes a password differently from the plain text", async () => {
    const hash = await hashPassword("password123");
    expect(hash).not.toBe("password123");
  });

  it("generates a different hash on every call (salting)", async () => {
    const hash1 = await hashPassword("password123");
    const hash2 = await hashPassword("password123");
    expect(hash1).not.toBe(hash2);
  });

  it("correctly verifies a valid password", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword("password123", hash)).resolves.toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword("wrongpassword", hash)).resolves.toBe(false);
  });
});
