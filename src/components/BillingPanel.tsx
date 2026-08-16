"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { color } from "@/lib/design/tokens";
import { api, ApiClientError, type BillingInfo } from "@/lib/apiClient";

// Miroir de NON_TERMINAL_SUBSCRIPTION_STATUSES (src/lib/services/billingService.ts) côté client —
// pas d'import direct possible, ce module tire `db` (server-only) dans le bundle client.
const TERMINAL_STATUSES = new Set(["canceled", "incomplete_expired"]);

const statusLabels: Record<string, string> = {
  trialing: "Essai en cours",
  active: "Actif",
  past_due: "Paiement en retard",
  canceled: "Résilié",
  unpaid: "Impayé",
  incomplete: "Paiement incomplet",
  incomplete_expired: "Paiement expiré",
};

export default function BillingPanel() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getBillingInfo().then(setInfo).catch(() => setError("Impossible de charger les informations de facturation."));
  }, []);

  async function handleCheckout(plan: "starter" | "pro") {
    setLoading(plan);
    setError(null);
    try {
      const { url } = await api.startCheckout(plan);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la création de la session de paiement.");
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
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'ouverture du portail de facturation.");
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
              Abonnement actuel
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 700, color: color.text }}>
              {subscription ? subscription.planName : "Essai gratuit"}
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
          {quota.used} / {quota.limit} scripts générés {subscription ? "ce mois-ci" : "(essai gratuit, à vie)"}
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
            Résiliation programmée
            {subscription.currentPeriodEnd
              ? ` — actif jusqu'au ${new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}`
              : "."}
          </p>
        )}

        {subscription && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${color.dividerAlt}`, marginTop: 4 }}>
            <Button variant="secondary" onClick={handlePortal} disabled={loading === "portal"}>
              {loading === "portal" ? "..." : "Gérer mon abonnement (moyen de paiement, factures, résiliation)"}
            </Button>
          </div>
        )}
        {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
      </Card>

      {subscription && !TERMINAL_STATUSES.has(subscription.status) && subscription.status !== "active" && subscription.status !== "trialing" && (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          Un abonnement est en cours mais nécessite ton attention (moyen de paiement à mettre à jour) — utilise
          « Gérer mon abonnement » ci-dessus plutôt que d&apos;en souscrire un nouveau.
        </p>
      )}

      {/* Un nouveau Checkout n'est proposé que sans abonnement ou après un abonnement définitivement
          clos (canceled/incomplete_expired) — cf. NON_TERMINAL_SUBSCRIPTION_STATUSES côté API,
          POST /api/billing/checkout renverrait sinon une 409. */}
      {(!subscription || TERMINAL_STATUSES.has(subscription.status)) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {plans.map((plan) => (
            <Card key={plan.id} style={{ padding: 24, display: "grid", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: color.text }}>{plan.name}</p>
              <p style={{ margin: 0, fontSize: 14, color: color.textSecondary }}>
                {plan.scriptsPerMonth} scripts générés par mois
              </p>
              <Button onClick={() => handleCheckout(plan.id)} disabled={loading === plan.id} fullWidth>
                {loading === plan.id ? "..." : "S'abonner"}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
