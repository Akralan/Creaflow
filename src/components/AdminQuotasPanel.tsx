"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { TextField, heading1Style } from "@/components/ui/TextField";
import { api, ApiClientError, type AdminAccountQuotas } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/** Quota field: empty = normal limit; otherwise an integer >= 0. */
function parseQuota(value: string): number | null | "invalid" {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : "invalid";
}

/**
 * /admin/quotas screen (docs/SPEC_QUOTAS_ADMIN.md): look up an account by email, see its
 * counters, give it a script and edit quota that replaces the normal limit.
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
      setError(err instanceof ApiClientError ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!account) return;
    const scripts = parseQuota(scriptLimit);
    const microEdits = parseQuota(microEditLimit);
    if (scripts === "invalid" || microEdits === "invalid") {
      setError("A quota is a whole number, or empty for the normal limit.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      show((await api.setAdminQuotas({ userId: account.userId, scriptLimit: scripts, microEditLimit: microEdits })).account);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, counter: Omit<AdminAccountQuotas["scripts"], "unit">, value: string, onChange: (v: string) => void, normal: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 160px", gap: 16, alignItems: "end" }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{label}</div>
        <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>
          {counter.used} used / {counter.limit} · {counter.planName}
        </div>
      </div>
      <TextField
        label="Custom quota"
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
            Admin: {adminEmail} · <Link href="/calendar">Back to the app</Link>
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
              <TextField label="Account email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="someone@example.com" />
            </div>
            <Button type="submit" disabled={busy || !email.trim()}>
              {busy && !account ? "…" : "Search"}
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
            My account
          </button>
        </Card>

        {error && <p style={{ margin: 0, fontSize: 14, color: color.danger }}>{error}</p>}

        {account && (
          <Card style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: color.text }}>{account.email}</div>
              <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>
                {account.subscription ? `${account.subscription.plan} subscription (${account.subscription.status})` : "Free trial, no subscription"}
              </div>
            </div>
            {row(account.scripts.unit === "weeks" ? "Free weeks" : "Scripts", account.scripts, scriptLimit, setScriptLimit, "normal limit")}
            {row("Edits", account.microEdits, microEditLimit, setMicroEditLimit, "normal limit")}
            <p style={{ margin: 0, fontSize: 12, color: color.textFaint, lineHeight: 1.5 }}>
              A custom quota replaces the trial or plan limit (over the same period: lifetime for the
              trial, the current month for a subscription). Empty = normal limit.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Button onClick={save} disabled={busy}>
                {busy ? "…" : "Save"}
              </Button>
              {saved && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Saved.</span>}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
