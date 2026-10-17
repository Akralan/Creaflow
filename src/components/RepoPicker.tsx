"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ConnectRepoResult, type GithubRepoOption } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { MAX_PRODUCTS } from "@/lib/validation";
import { oauthStartUrl } from "@/components/onboarding/OnboardingWelcome";

/** Sélecteur de dépôts publics : étape « Projets » de l'onboarding dev, et paramètres > Sujets
 *  (`variant="settings"`) pour connecter de nouveaux dépôts après coup. En variante settings, pas
 *  de bouton d'échappement « Décrire mes sujets à la main » — le catalogue manuel est juste à côté. */
export default function RepoPicker({
  onConnected,
  variant = "onboarding",
  preselect = 0,
}: {
  onConnected: () => void;
  variant?: "onboarding" | "settings";
  /** Coche d'avance les N dépôts poussés le plus récemment (docs/SPEC_ONBOARDING_MVP.md §2 écran 2). */
  preselect?: number;
}) {
  const [repos, setRepos] = useState<GithubRepoOption[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [results, setResults] = useState<ConnectRepoResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Jeton GitHub révoqué ou expiré (409) : on propose de reconnecter au lieu de dire « aucun dépôt ».
  const [needsReconnect, setNeedsReconnect] = useState(false);

  useEffect(() => {
    api
      .getGithubRepos()
      .then(({ repos }) => {
        setRepos(repos);
        const recent = repos
          .filter((r) => !r.alreadyConnected)
          .sort((a, b) => b.pushedAt.localeCompare(a.pushedAt))
          .slice(0, Math.min(preselect, MAX_PRODUCTS));
        setSelected(recent.map((r) => r.externalId));
      })
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : "Impossible de lire tes dépôts GitHub.");
        setNeedsReconnect(err instanceof ApiClientError && err.status === 409);
      })
      .finally(() => setLoading(false));
    // preselect ne sert qu'au premier chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Lecture impossible : l'erreur seule, jamais « aucun dépôt public » qui ferait croire le compte vide.
  if (error && repos.length === 0) {
    return (
      <div>
        <p style={{ color: color.danger, fontSize: 14, margin: "0 0 12px" }}>{error}</p>
        {needsReconnect && (
          <Button
            onClick={() => {
              window.location.href = oauthStartUrl("github", window.location.pathname + window.location.search);
            }}
          >
            Reconnecter GitHub
          </Button>
        )}
      </div>
    );
  }

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
          {variant === "onboarding" && " Tu peux brancher une autre source ou coller tes notes."}
        </p>
        {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
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
