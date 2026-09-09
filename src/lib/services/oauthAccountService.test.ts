import { describe, expect, it } from "vitest";
import { decideAccountResolution } from "./oauthAccountService";

describe("decideAccountResolution", () => {
  it("connecte sur le compte déjà lié à cette identité tierce", () => {
    expect(decideAccountResolution({ identityUserId: "u1", hasVerifiedEmail: true, userIdWithSameEmail: "u2" })).toEqual(
      { action: "login", userId: "u1" }
    );
  });

  it("rattache l'identité au compte existant quand l'email est vérifié", () => {
    expect(
      decideAccountResolution({ identityUserId: null, hasVerifiedEmail: true, userIdWithSameEmail: "u2" })
    ).toEqual({ action: "link", userId: "u2" });
  });

  it("crée un compte quand l'email vérifié ne correspond à personne", () => {
    expect(decideAccountResolution({ identityUserId: null, hasVerifiedEmail: true, userIdWithSameEmail: null })).toEqual(
      { action: "create" }
    );
  });

  it("refuse sans email vérifié, même si aucun compte ne porte cette adresse", () => {
    const result = decideAccountResolution({
      identityUserId: null,
      hasVerifiedEmail: false,
      userIdWithSameEmail: null,
    });
    expect(result.action).toBe("reject");
  });

  it("refuse le rattachement sur un email non vérifié — c'est une prise de contrôle de compte", () => {
    const result = decideAccountResolution({
      identityUserId: null,
      hasVerifiedEmail: false,
      userIdWithSameEmail: "u2",
    });
    expect(result.action).toBe("reject");
  });

  it("privilégie l'identité connue même sans email vérifié — le compte est déjà prouvé", () => {
    expect(
      decideAccountResolution({ identityUserId: "u1", hasVerifiedEmail: false, userIdWithSameEmail: null })
    ).toEqual({ action: "login", userId: "u1" });
  });
});
