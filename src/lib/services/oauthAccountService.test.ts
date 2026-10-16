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

  describe("mode « brancher une source » (session ouverte)", () => {
    const base = { hasVerifiedEmail: false, userIdWithSameEmail: null, providerId: "github" };

    it("rattache au compte connecté, sans exiger d'email vérifié ni correspondant", () => {
      expect(decideAccountResolution({ ...base, identityUserId: null, sessionUserId: "me" })).toEqual({
        action: "link",
        userId: "me",
      });
    });

    it("ignore un compte qui porterait le même email : c'est la session qui fait foi", () => {
      expect(
        decideAccountResolution({ ...base, hasVerifiedEmail: true, userIdWithSameEmail: "autre", identityUserId: null, sessionUserId: "me" })
      ).toEqual({ action: "link", userId: "me" });
    });

    it("rafraîchit simplement une identité déjà reliée au compte connecté", () => {
      expect(decideAccountResolution({ ...base, identityUserId: "me", sessionUserId: "me" })).toEqual({
        action: "login",
        userId: "me",
      });
    });

    it("refuse une identité déjà reliée à un autre compte CreaFlow", () => {
      expect(decideAccountResolution({ ...base, identityUserId: "autre", sessionUserId: "me" }).action).toBe("reject");
    });

    it("refuse un second compte du même fournisseur sur le même compte CreaFlow", () => {
      expect(
        decideAccountResolution({ ...base, identityUserId: null, sessionUserId: "me", sessionUserHasOtherIdentity: true }).action
      ).toBe("reject");
    });
  });
});
