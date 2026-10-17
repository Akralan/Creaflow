import { describe, expect, it } from "vitest";
import { CUSTOM_QUOTA_NAME, effectiveLimit, resolveQuotaStatus, toDbSubscriptionStatus } from "./billingService";

describe("resolveQuotaStatus", () => {
  it("autorise tant que le nombre utilisé est strictement inférieur à la limite", () => {
    expect(resolveQuotaStatus(0, 5, "Essai gratuit")).toEqual({
      allowed: true,
      used: 0,
      limit: 5,
      planName: "Essai gratuit",
    });
    expect(resolveQuotaStatus(4, 5, "Essai gratuit").allowed).toBe(true);
  });

  it("bloque dès que le nombre utilisé atteint la limite", () => {
    expect(resolveQuotaStatus(5, 5, "Essai gratuit").allowed).toBe(false);
  });

  it("bloque au-delà de la limite (ex. dépassement dû à une régénération concurrente)", () => {
    expect(resolveQuotaStatus(6, 5, "Essai gratuit").allowed).toBe(false);
  });

  it("reflète le nom du plan tel que passé, sans logique cachée", () => {
    expect(resolveQuotaStatus(10, 150, "Pro").planName).toBe("Pro");
  });
});

describe("toDbSubscriptionStatus", () => {
  it("laisse passer tel quel un statut Stripe connu de l'enum", () => {
    expect(toDbSubscriptionStatus("active")).toBe("active");
    expect(toDbSubscriptionStatus("trialing")).toBe("trialing");
    expect(toDbSubscriptionStatus("canceled")).toBe("canceled");
  });

  it("fait tomber un statut hors enum (ex. \"paused\", non proposé en v1) sur \"past_due\"", () => {
    expect(toDbSubscriptionStatus("paused")).toBe("past_due");
  });
});

describe("effectiveLimit (docs/SPEC_QUOTAS_ADMIN.md)", () => {
  it("le quota propre au compte remplace la limite normale ; null la laisse", () => {
    const normal = { limit: 5, planName: "Essai gratuit" };
    expect(effectiveLimit(normal, null)).toEqual(normal);
    expect(effectiveLimit(normal, 100)).toEqual({ limit: 100, planName: CUSTOM_QUOTA_NAME });
    expect(effectiveLimit(normal, 0)).toEqual({ limit: 0, planName: CUSTOM_QUOTA_NAME });
  });
});
