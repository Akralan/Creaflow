import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hash un mot de passe différemment du texte en clair", async () => {
    const hash = await hashPassword("password123");
    expect(hash).not.toBe("password123");
  });

  it("génère un hash différent à chaque appel (salage)", async () => {
    const hash1 = await hashPassword("password123");
    const hash2 = await hashPassword("password123");
    expect(hash1).not.toBe(hash2);
  });

  it("vérifie correctement un mot de passe valide", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword("password123", hash)).resolves.toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hash = await hashPassword("password123");
    await expect(verifyPassword("wrongpassword", hash)).resolves.toBe(false);
  });
});
