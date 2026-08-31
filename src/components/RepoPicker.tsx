"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ConnectRepoResult, type GithubRepoOption } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { MAX_PRODUCTS } from "@/lib/validation";

export default function RepoPicker({ onConnected }: { onConnected: () => void }) {
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

  // Jamais un cul-de-sac : sans dépôt public, on renvoie vers la saisie manuelle de sujets.
  if (repos.length === 0) {
    return (
      <div>
        <p style={{ color: color.textMuted, fontSize: 15, margin: "0 0 16px" }}>
          Aucun dépôt public trouvé sur ton compte GitHub. Tu peux décrire tes sujets à la main — la matière se
          colle ensuite depuis l&apos;écran du sujet.
        </p>
        {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <Button onClick={onConnected}>Décrire mes sujets à la main</Button>
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
          return (
            <button
              key={repo.externalId}
              onClick={() => toggle(repo.externalId)}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: 12,
                border: `1px solid ${isSelected ? accent : color.border}`,
                background: isSelected ? accentAlpha(0.08) : color.cardBg,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{repo.name}</div>
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
