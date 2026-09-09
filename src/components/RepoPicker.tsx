"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ConnectRepoResult, type GithubRepoOption } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { MAX_PRODUCTS } from "@/lib/validation";

/** Sélecteur de dépôts publics : étape « Projets » de l'onboarding dev, et paramètres > Sujets
 *  (`variant="settings"`) pour connecter de nouveaux dépôts après coup. En variante settings, pas
 *  de bouton d'échappement « Décrire mes sujets à la main » — le catalogue manuel est juste à côté. */
export default function RepoPicker({
  onConnected,
  variant = "onboarding",
}: {
  onConnected: () => void;
  variant?: "onboarding" | "settings";
}) {
  const [repos, setRepos] = useState<GithubRepoOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [results, setResults] = useState<ConnectRepoResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getGithubRepos()
      .then(({ repos }) => setRepos(repos))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Impossible de lire tes dépôts GitHub."))
      .finally(() => setLoading(false));
  }, []);

  function toggle(externalId: string) {
    setSelected((prev) =>
      prev.includes(externalId)
        ? prev.filter((id) => id !== externalId)
        : prev.length >= MAX_PRODUCTS
          ? prev
          : [...prev, externalId]
    );
  }

  async function connect() {
    setConnecting(true);
    setError(null);
    try {
      const { results } = await api.connectGithubRepos(repos.filter((r) => selected.includes(r.externalId)));
      setResults(results);
      onConnected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La récupération de la matière a échoué.");
    } finally {
      setConnecting(false);
    }
  }

  if (loading) return <p style={{ color: color.textMuted, fontSize: 14 }}>Lecture de tes dépôts…</p>;

  const selectable = repos.filter((r) => !r.alreadyConnected);

  // Jamais un cul-de-sac : sans dépôt disponible, l'onboarding renvoie vers la saisie manuelle de
  // sujets ; dans les paramètres, le catalogue manuel est déjà sous les yeux — un message suffit.
  if (selectable.length === 0) {
    const message =
      repos.length > 0
        ? "Tous tes dépôts publics sont déjà connectés comme sujets."
        : "Aucun dépôt public trouvé sur ton compte GitHub.";
    return (
      <div>
        <p style={{ color: color.textMuted, fontSize: 15, margin: "0 0 16px" }}>
          {message}
          {variant === "onboarding" &&
            " Tu peux décrire tes sujets à la main — la matière se colle ensuite depuis l'écran du sujet."}
        </p>
        {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {variant === "onboarding" && <Button onClick={onConnected}>Décrire mes sujets à la main</Button>}
      </div>
    );
  }

  if (results) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {results.map((result) => (
          <div key={result.sourceId} style={{ fontSize: 14, color: result.error ? color.danger : color.textSecondary }}>
            <strong>{result.label}</strong>{" "}
            {result.error
              ? `— échec : ${result.error}`
              : `— ${result.report!.added} document${result.report!.added > 1 ? "s" : ""} récupéré${
                  result.report!.added > 1 ? "s" : ""
                }`}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
        {repos.map((repo) => {
          const isSelected = selected.includes(repo.externalId);
          const disabled = repo.alreadyConnected;
          return (
            <button
              key={repo.externalId}
              onClick={() => !disabled && toggle(repo.externalId)}
              disabled={disabled}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${isSelected ? accent : color.border}`,
                background: isSelected ? accentAlpha(0.08) : color.cardBg,
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.55 : 1,
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{repo.name}</span>
                {disabled && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: 12,
                      background: color.chipBg,
                      color: color.textMuted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Déjà un sujet
                  </span>
                )}
              </div>
              {repo.description && (
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>{repo.description}</div>
              )}
              <div style={{ fontSize: 12, color: color.textFaint, marginTop: 6 }}>
                {[repo.language, `mis à jour le ${repo.pushedAt.slice(0, 10)}`].filter(Boolean).join(" · ")}
              </div>
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <Button onClick={connect} disabled={selected.length === 0 || connecting}>
        {connecting
          ? "Récupération de la matière…"
          : `Utiliser ${selected.length} projet${selected.length > 1 ? "s" : ""} comme sujets`}
      </Button>
      <p style={{ fontSize: 12, color: color.textFaint, marginTop: 10 }}>
        {selected.length} sur {MAX_PRODUCTS} maximum. On récupère les fichiers .md et l&apos;historique des commits.
      </p>
    </div>
  );
}
