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
 * Onglet « Compte » de /settings (docs/SPEC_LEGAL_EMAIL_RGPD.md §4.1) : la personne, pas sa marque.
 * Quatre blocs — email, mot de passe, export, suppression.
 */
export default function AccountPanel() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAccount()
      .then(({ account }) => setAccount(account))
      .catch(() => setLoadError("Impossible de charger les informations du compte."));
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
              · connecté via {account.providers.map((p) => p.displayName).join(", ")}
            </>
          )}
        </p>
        <p style={{ ...blockHint, margin: 0, fontSize: 13, color: color.textFaint }}>
          Le changement d&apos;adresse n&apos;est pas encore disponible. Écrivez-nous si vous en avez besoin.
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
      setError("Les deux mots de passe ne correspondent pas.");
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
      setError(errorMessage(err, "Erreur lors de la modification du mot de passe."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card style={{ padding: 28 }}>
      <h2 style={blockTitle}>{hasPassword ? "Mot de passe" : "Définir un mot de passe"}</h2>
      <p style={blockHint}>
        {hasPassword
          ? "Le changement ferme vos autres sessions ouvertes et vous est confirmé par email."
          : "Votre compte a été créé via un service tiers. Un mot de passe vous permettra aussi de vous connecter par email."}
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14, maxWidth: 400 }}>
        {hasPassword && (
          <TextField
            label="Mot de passe actuel"
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        )}
        <TextField
          label="Nouveau mot de passe"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          helper="8 caractères minimum"
        />
        <TextField
          label="Confirmer"
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
            {saving ? "..." : hasPassword ? "Changer le mot de passe" : "Définir le mot de passe"}
          </Button>
          {done && <span style={{ fontSize: 13, color: "oklch(0.5 0.14 150)" }}>Mot de passe modifié.</span>}
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
      link.download = `creaflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "Erreur lors de la préparation de l'export."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ padding: 28 }}>
      <h2 style={blockTitle}>Vos données</h2>
      <p style={blockHint}>
        Un fichier JSON avec tout ce que CreaFlow conserve sur vous : profil, sujets, matière, séries,
        scripts, calendrier, connexions (sans leurs jetons d&apos;accès) et abonnement. Les images y sont
        référencées par leur adresse.
      </p>
      {error && <p style={{ color: color.danger, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
      <Button variant="secondary" onClick={handleExport} disabled={loading} style={{ padding: "11px 22px", fontSize: 14 }}>
        {loading ? "Préparation..." : "Télécharger mes données"}
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
      // Navigation complète plutôt que router.push : on repart d'un état vierge, sans rien du compte en mémoire.
      window.location.assign("/login?deleted=1");
    } catch (err) {
      setError(errorMessage(err, "Erreur lors de la suppression du compte."));
      setLoading(false);
    }
  }

  return (
    <Card style={{ padding: 28, borderColor: color.dangerBorder }}>
      <h2 style={{ ...blockTitle, color: color.danger }}>Supprimer mon compte</h2>
      <p style={blockHint}>
        Effacement immédiat de votre profil, votre matière, vos scripts, votre calendrier, vos images et
        vos connexions. L&apos;abonnement éventuel est résilié sans remboursement de la période en cours.
        Vos factures restent chez Stripe pour la durée légale. Pensez à révoquer les accès accordés
        depuis les réglages de chaque plateforme connectée.
      </p>
      {!open ? (
        <Button variant="secondary" onClick={() => setOpen(true)} style={{ padding: "11px 22px", fontSize: 14, color: color.danger }}>
          Supprimer mon compte
        </Button>
      ) : (
        <form onSubmit={handleDelete} style={{ display: "grid", gap: 14, maxWidth: 400 }}>
          <TextField
            label={hasPassword ? "Votre mot de passe, pour confirmer" : "Recopiez votre adresse email, pour confirmer"}
            type={hasPassword ? "password" : "email"}
            required
            autoComplete={hasPassword ? "current-password" : "off"}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          {error && <p style={{ color: color.danger, fontSize: 13, margin: 0 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <Button type="submit" disabled={loading} style={{ padding: "11px 22px", fontSize: 14, background: loading ? undefined : color.danger }}>
              {loading ? "Suppression..." : "Supprimer définitivement"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setOpen(false); setConfirmation(""); setError(null); }}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
