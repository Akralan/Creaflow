"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ConnectRepoResult, type SourceCandidate } from "@/lib/apiClient";
import { accent, accentAlpha, color } from "@/lib/design/tokens";
import { MAX_PRODUCTS } from "@/lib/validation";

/**
 * Sélecteur de sources, quel que soit le fournisseur : étape « sujets » de l'onboarding, et
 * paramètres > Sujets (`variant="settings"`) pour en brancher après coup.
 *
 * Générique par construction — tout ce qui parle du fournisseur (message de liste vide, note de bas
 * d'écran, ligne de contexte sous chaque candidat) vient de la route, qui le tient du connecteur.
 * `RepoPicker` reste en place pour GitHub : sa route porte la forme « dépôt » et ses tests avec,
 * et l'architecture autorise explicitement un écran de sélection par connecteur.
 */
export default function SourcePicker({
  provider,
  onConnected,
  variant = "onboarding",
  preselect = 0,
}: {
  provider: string;
  onConnected: () => void;
  variant?: "onboarding" | "settings";
  /** Coche d'avance les N premiers éléments proposés (docs/SPEC_ONBOARDING_MVP.md §2 écran 2). */
  preselect?: number;
}) {
  const [candidates, setCandidates] = useState<SourceCandidate[]>([]);
  const [texts, setTexts] = useState({ displayName: "", emptyMessage: "", footnote: "" });
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [results, setResults] = useState<ConnectRepoResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pas de remise à zéro de l'état ici : les appelants montent le composant avec key={provider},
  // donc un changement de fournisseur remonte un composant neuf plutôt que d'en recycler l'état.
  useEffect(() => {
    let cancelled = false;
    api
      .getSourceCandidates(provider)
      .then((data) => {
        if (cancelled) return;
        setCandidates(data.candidates);
        setSelected(
          data.candidates
            .filter((c) => !c.alreadyConnected)
            .slice(0, Math.min(preselect, MAX_PRODUCTS))
            .map((c) => c.externalId)
        );
        setTexts({ displayName: data.displayName, emptyMessage: data.emptyMessage, footnote: data.footnote });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiClientError ? err.message : "Impossible de lire tes sources.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // preselect ne sert qu'au premier chargement : le changer ensuite ne doit pas écraser les choix.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

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
      const chosen = candidates.filter((candidate) => selected.includes(candidate.externalId));
      const { results } = await api.connectSources(provider, chosen);
      setResults(results);
      onConnected();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La récupération de la matière a échoué.");
    } finally {
      setConnecting(false);
    }
  }

  if (loading) return <p style={{ color: color.textMuted, fontSize: 14 }}>Lecture de tes sources…</p>;

  const selectable = candidates.filter((candidate) => !candidate.alreadyConnected);

  // Jamais un cul-de-sac : sans candidat disponible, l'onboarding renvoie vers la saisie manuelle
  // de sujets ; dans les paramètres, le catalogue manuel est déjà sous les yeux.
  if (selectable.length === 0) {
    const message =
      candidates.length > 0
        ? `Toutes tes sources ${texts.displayName} sont déjà connectées comme sujets.`
        : texts.emptyMessage;
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
        {candidates.map((candidate) => {
          const isSelected = selected.includes(candidate.externalId);
          const disabled = candidate.alreadyConnected;
          return (
            <button
              key={candidate.externalId}
              onClick={() => !disabled && toggle(candidate.externalId)}
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
                <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{candidate.subjectName}</span>
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
              {candidate.subjectDescription && (
                <div style={{ fontSize: 13, color: color.textMuted, marginTop: 4 }}>{candidate.subjectDescription}</div>
              )}
              {candidate.hint && (
                <div style={{ fontSize: 12, color: color.textFaint, marginTop: 6 }}>{candidate.hint}</div>
              )}
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <Button onClick={connect} disabled={selected.length === 0 || connecting}>
        {connecting
          ? "Récupération de la matière…"
          : `Utiliser ${selected.length} source${selected.length > 1 ? "s" : ""} comme sujets`}
      </Button>
      <p style={{ fontSize: 12, color: color.textFaint, marginTop: 10 }}>
        {selected.length} sur {MAX_PRODUCTS} maximum. {texts.footnote}
      </p>
    </div>
  );
}
