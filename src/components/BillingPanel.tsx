"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { color } from "@/lib/design/tokens";
import { api, ApiClientError, type BillingInfo } from "@/lib/apiClient";

// Client-side mirror of NON_TERMINAL_SUBSCRIPTION_STATUSES (src/lib/services/billingService.ts) —
// no direct import possible, that module pulls `db` (server-only) into the client bundle.
const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);

const statusLabels: Record<string, string> = {
  trialing: "Trial in progress",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
  unpaid: "Unpaid",
  incomplete: "Payment incomplete",
  incomplete_expired: "Payment expired",
};

export default function BillingPanel() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBillingInfo().then(setInfo).catch(() => setError("Unable to load billing information."));
  }, []);

  async function handleCheckout(plan: "starter" | "pro") {
    setLoading(plan);
    setError(null);
    try {
      const { url } = await api.startCheckout(plan);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Error while creating the checkout session.");
      setLoading(null);
    }
  }

  async function handlePortal() {
    setLoading("portal");
    setError(null);
    try {
      const { url } = await api.openBillingPortal();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Error while opening the billing portal.");
      setLoading(null);
    }
  }

  if (!info) return null;

  const { subscription, quota, plans } = info;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Card style={{ padding: 24, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: color.textMuted, textTransform: "uppercase" }}>
              Current subscription
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: color.text }}>
              {subscription ? subscription.planName : "Free trial"}
            </p>
          </div>
          {subscription && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 20,
                background: subscription.status === "active" ? "oklch(0.62 0.14 150 / 0.14)" : color.chipBg,
                color: subscription.status === "active" ? "oklch(0.42 0.14 150)" : color.textSecondary,
              }}
            >
              {statusLabels[subscription.status] ?? subscription.status}
            </span>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 14, color: color.textSecondary }}>
          {quota.unit === "weeks"
            ? `${quota.used} / ${quota.limit} free ${quota.limit === 1 ? "week" : "weeks"} used (free trial, lifetime)`
            : `${quota.used} / ${quota.limit} scripts generated this month`}
        </p>
        <div style={{ height: 6, borderRadius: 3, background: color.trackBg, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, (quota.used / quota.limit) * 100)}%`,
              background: quota.allowed ? "oklch(0.62 0.14 150)" : color.danger,
            }}
          />
        </div>

        {subscription && subscription.cancelAtPeriodEnd && (
          <p style={{ margin: 0, fontSize: 13, color: color.danger }}>
            Cancellation scheduled
            {subscription.currentPeriodEnd
              ? ` — active until ${new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US")}`
              : "."}
          </p>
        )}

        {subscription && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${color.dividerAlt}`, marginTop: 4 }}>
            <Button variant="secondary" onClick={handlePortal} disabled={loading === "portal"}>
              {loading === "portal" ? "..." : "Manage subscription (payment method, invoices, cancellation)"}
            </Button>
          </div>
        )}
        {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
      </Card>

      {subscription && !TERMINAL_STATUSES.has(subscription.status) && subscription.status !== "active" && subscription.status !== "trialing" && (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          A subscription is in progress but needs your attention (payment method to update) — use
          &quot;Manage subscription&quot; above rather than subscribing again.
        </p>
      )}

      {/* A new Checkout is offered only with no subscription or after a subscription that is
          definitively closed (canceled/incomplete_expired) — see NON_TERMINAL_SUBSCRIPTION_STATUSES
          on the API side, POST /api/billing/checkout would otherwise return a 409. */}
      {(!subscription || TERMINAL_STATUSES.has(subscription.status)) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {plans.map((plan) => (
            <Card key={plan.id} style={{ padding: 24, display: "grid", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: color.text }}>{plan.name}</p>
              <p style={{ margin: 0, fontSize: 14, color: color.textSecondary }}>
                {plan.scriptsPerMonth} scripts generated per month
              </p>
              <Button onClick={() => handleCheckout(plan.id)} disabled={loading === plan.id} fullWidth>
                {loading === plan.id ? "..." : "Subscribe"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
