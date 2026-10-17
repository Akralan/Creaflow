"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, heading1Style } from "@/components/ui/TextField";
import { api, ApiClientError, type AdminAccountQuotas } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/** Champ de quota : vide = limite normale ; sinon un entier ≥ 0. */
function parseQuota(value: string): number | null | "invalide" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : "invalide";
}

/**
 * Écran /admin/quotas (docs/SPEC_QUOTAS_ADMIN.md) : chercher un compte par email, voir ses
 * compteurs, lui donner un quota de scripts et de retouches qui remplace la limite normale.
 */
export default function AdminQuotasPanel({ adminEmail }: { adminEmail: string }) {
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<AdminAccountQuotas | null>(null);
  const [scriptLimit, setScriptLimit] = useState("");
  const [microEditLimit, setMicroEditLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function show(next: AdminAccountQuotas) {
    setAccount(next);
    setScriptLimit(next.scripts.custom === null ? "" : String(next.scripts.custom));
    setMicroEditLimit(next.microEdits.custom === null ? "" : String(next.microEdits.custom));
  }

  async function search(target = email) {
    if (!target.trim()) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      show((await api.getAdminQuotas(target.trim())).account);
    } catch (err) {
      setAccount(null);
      setError(err instanceof ApiClientError ? err.message : "Recherche impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!account) return;
    const scripts = parseQuota(scriptLimit);
    const microEdits = parseQuota(microEditLimit);
    if (scripts === "invalide" || microEdits === "invalide") {
      setError("Un quota est un nombre entier, ou vide pour la limite normale.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      show((await api.setAdminQuotas({ userId: account.userId, scriptLimit: scripts, microEditLimit: microEdits })).account);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, counter: AdminAccountQuotas["scripts"], value: string, onChange: (v: string) => void, normal: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 16, alignItems: "end" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{label}</div>
        <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>
          {counter.used} utilisé{counter.used > 1 ? "s" : ""} / {counter.limit} · {counter.planName}
        </div>
      </div>
      <TextField
        label="Quota perso"
        inputMode="numeric"
        value={value}
        placeholder={normal}
        onChange={(e) => {
          setSaved(false);
          onChange(e.target.value);
        }}
      />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: color.pageBg, padding: "40px 16px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto", display: "grid", gap: 20 }}>
        <div>
          <h1 style={heading1Style}>Quotas</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: color.textMuted }}>
            Admin : {adminEmail} · <Link href="/calendar">Retour à l&apos;application</Link>
          </p>
        </div>

        <Card>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
            style={{ display: "flex", gap: 10, alignItems: "flex-end" }}
          >
            <div style={{ flex: 1 }}>
              <TextField label="Email du compte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="personne@exemple.fr" />
            </div>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy && !account ? "…" : "Chercher"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => {
              setEmail(adminEmail);
              search(adminEmail);
            }}
            style={{ marginTop: 10, background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, color: color.textMuted, cursor: "pointer", textDecoration: "underline" }}
          >
            Mon compte
          </button>
        </Card>

        {error && <p style={{ margin: 0, fontSize: 14, color: color.danger }}>{error}</p>}

        {account && (
          <Card style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: color.text }}>{account.email}</div>
              <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>
                {account.subscription ? `Abonnement ${account.subscription.plan} (${account.subscription.status})` : "Essai gratuit, sans abonnement"}
              </div>
            </div>
            {row("Scripts", account.scripts, scriptLimit, setScriptLimit, "limite normale")}
            {row("Retouches", account.microEdits, microEditLimit, setMicroEditLimit, "limite normale")}
            <p style={{ margin: 0, fontSize: 12, color: color.textFaint, lineHeight: 1.5 }}>
              Un quota perso remplace la limite de l&apos;essai ou du plan (sur la même période : depuis toujours pour
              l&apos;essai, le mois en cours pour un abonnement). Vide = limite normale.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Button onClick={save} disabled={busy}>
                {busy ? "…" : "Enregistrer"}
              </Button>
              {saved && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Enregistré.</span>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
