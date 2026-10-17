"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { color, fontHeading } from "@/lib/design/tokens";
import { api, ApiClientError, type AccountSummary } from "@/lib/apiClient";

const blockTitle: React.CSSProperties = { fontFamily: fontHeading, fontWeight: 700, fontSize: 17, margin: "0 0 4px", color: color.text };
const blockHint: React.CSSProperties = { margin: "0 0 16px", fontSize: 14, color: color.textMuted, lineHeight: 1.5 };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

/**
 * "Account" tab of /settings (docs/SPEC_LEGAL_EMAIL_RGPD.md §4.1): the person, not their brand.
 * Four blocks — email, password, export, deletion.
 */
export default function AccountPanel() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAccount()
      .then(({ account }) => setAccount(account))
      .catch(() => setLoadError("Unable to load account information."));
  }, []);

  if (loadError) return <p style={{ color: color.danger, fontSize: 13 }}>{loadError}</p>;
  if (!account) return null;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Card style={{ padding: 28 }}>
        <h2 style={blockTitle}>Email</h2>
        <p style={blockHint}>
          {account.email}
          {account.providers.length > 0 && (
            <>
              {" "}
              · signed in via {account.providers.map((p) => p.displayName).join(", ")}
            </>
          )}
        </p>
        <p style={{ ...blockHint, margin: 0, fontSize: 13, color: color.textFaint }}>
          Changing your email address is not available yet. Write to us if you need it.
        </p>
      </Card>

      <PasswordBlock hasPassword={account.hasPassword} onChanged={() => setAccount({ ...account, hasPassword: true })} />
      <ExportBlock />
      <DeleteBlock hasPassword={account.hasPassword} />
    </div>
  );
}

function PasswordBlock({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(hasPassword ? current : undefined, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Error while changing the password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ padding: 28 }}>
      <h2 style={blockTitle}>{hasPassword ? "Password" : "Set a password"}</h2>
      <p style={blockHint}>
        {hasPassword
          ? "Changing it signs you out of your other open sessions, and you'll get a confirmation by email."
          : "Your account was created through a third-party service. A password will also let you sign in with your email."}
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, maxWidth: 400 }}>
        {hasPassword && (
          <TextField
            label="Current password"
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <TextField
          label="New password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          helper="At least 8 characters"
        />
        <TextField
          label="Confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button type="submit" disabled={saving} style={{ padding: "11px 22px", fontSize: 14 }}>
            {saving ? "..." : hasPassword ? "Change password" : "Set password"}
          </Button>
          {done && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Password changed.</span>}
        </div>
      </form>
    </Card>
  );
}

function ExportBlock() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.exportAccount();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tellovo-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "Error while preparing the export."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ padding: 28 }}>
      <h2 style={blockTitle}>Your data</h2>
      <p style={blockHint}>
        A JSON file with everything Tellovo keeps about you: profile, topics, material, series,
        scripts, calendar, connections (without their access tokens) and subscription. Images are
        referenced in it by their address.
      </p>
      {error && <p style={{ color: color.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
      <Button variant="secondary" onClick={handleExport} disabled={loading} style={{ padding: "11px 22px", fontSize: 14 }}>
        {loading ? "Preparing..." : "Download my data"}
      </Button>
    </Card>
  );
}

function DeleteBlock({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.deleteAccount(hasPassword ? { password: confirmation } : { emailConfirmation: confirmation });
      // Full navigation rather than router.push: we start from a clean state, with nothing from the account left in memory.
      window.location.assign("/login?deleted=1");
    } catch (err) {
      setError(errorMessage(err, "Error while deleting the account."));
      setLoading(false);
    }
  }

  return (
    <Card style={{ padding: 28, borderColor: color.dangerBorder }}>
      <h2 style={{ ...blockTitle, color: color.danger }}>Delete my account</h2>
      <p style={blockHint}>
        Your profile, material, scripts, calendar, images and connections are erased immediately. Any
        subscription is canceled without a refund for the current period. Your invoices stay with
        Stripe for the legal period. Remember to revoke the access you granted from the settings of
        each connected platform.
      </p>
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)} style={{ padding: "11px 22px", fontSize: 14, color: color.danger }}>
          Delete my account
        </Button>
      ) : (
        <form onSubmit={handleDelete} style={{ display: "grid", gap: 14, maxWidth: 400 }}>
          <TextField
            label={hasPassword ? "Your password, to confirm" : "Re-enter your email address, to confirm"}
            type={hasPassword ? "password" : "email"}
            required
            autoComplete={hasPassword ? "current-password" : "off"}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <Button type="submit" disabled={loading} style={{ padding: "11px 22px", fontSize: 14, background: loading ? undefined : color.danger }}>
              {loading ? "Deleting..." : "Delete permanently"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setConfirmation(""); setError(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
