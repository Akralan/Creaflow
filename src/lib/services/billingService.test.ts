import { describe, expect, it } from "vitest";
import { CUSTOM_QUOTA_NAME, effectiveLimit, resolveQuotaStatus, toDbSubscriptionStatus } from "./billingService";

describe("resolveQuotaStatus", () => {
  it("allows as long as the used count is strictly below the limit", () => {
    expect(resolveQuotaStatus(0, 5, "Free trial")).toEqual({
      allowed: true,
      used: 0,
      limit: 5,
      planName: "Free trial",
    });
    expect(resolveQuotaStatus(4, 5, "Free trial").allowed).toBe(true);
  });

  it("blocks as soon as the used count reaches the limit", () => {
    expect(resolveQuotaStatus(5, 5, "Free trial").allowed).toBe(false);
  });

  it("blocks beyond the limit (e.g. overshoot due to a concurrent regeneration)", () => {
    expect(resolveQuotaStatus(6, 5, "Free trial").allowed).toBe(false);
  });

  it("reflects the plan name as passed, with no hidden logic", () => {
    expect(resolveQuotaStatus(10, 150, "Pro").planName).toBe("Pro");
  });
});

describe("toDbSubscriptionStatus", () => {
  it("passes a Stripe status known to the enum through unchanged", () => {
    expect(toDbSubscriptionStatus("active")).toBe("active");
    expect(toDbSubscriptionStatus("trialing")).toBe("trialing");
    expect(toDbSubscriptionStatus("canceled")).toBe("canceled");
  });

  it("maps a status outside the enum (e.g. \"paused\", not offered in v1) to \"past_due\"", () => {
    expect(toDbSubscriptionStatus("paused")).toBe("past_due");
  });
});

describe("effectiveLimit (docs/SPEC_QUOTAS_ADMIN.md)", () => {
  it("the account's own quota replaces the normal limit; null leaves it", () => {
    const normal = { limit: 5, planName: "Free trial" };
    expect(effectiveLimit(normal, null)).toEqual(normal);
    expect(effectiveLimit(normal, 100)).toEqual({ limit: 100, planName: CUSTOM_QUOTA_NAME });
    expect(effectiveLimit(normal, 0)).toEqual({ limit: 0, planName: CUSTOM_QUOTA_NAME });
  });
});
