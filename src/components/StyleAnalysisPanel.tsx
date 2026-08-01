"use client";

import { useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";

function summarize(styleProfile: { tone: string; sentenceLength: string; emojiUsage: string; vocabulary: string }) {
  return [
    `Ton : ${styleProfile.tone}`,
    styleProfile.sentenceLength,
    `Emojis : ${styleProfile.emojiUsage}`,
    `Registre : ${styleProfile.vocabulary}`,
  ];
}

export default function StyleAnalysisPanel() {
  const [summary, setSummary] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then(({ profile }) => {
      if (profile?.styleProfile) setSummary(summarize(profile.styleProfile));
    });
  }, []);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const { profile } = await api.triggerStyleAnalysis();
      if (profile.styleProfile) setSummary(summarize(profile.styleProfile));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Analyse impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: `1px solid ${accentAlpha(0.25)}`, background: accentAlpha(0.06), borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Style de communication détecté</div>
        <button
          onClick={runAnalysis}
          disabled={loading}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "oklch(0.48 0.2 292)",
            background: color.cardBg,
            border: "1px solid oklch(0.6 0.15 292)",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: loading ? "default" : "pointer",
            flexShrink: 0,
          }}
        >
          {loading ? "Analyse..." : "Relancer l'analyse"}
        </button>
      </div>
      {error && <p style={{ margin: "0 0 8px", fontSize: 12, color: color.danger }}>{error}</p>}
      {summary ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
          {summary.map((s) => (
            <span key={s} style={{ background: color.cardBg, border: `1px solid ${color.border}`, borderRadius: 8, padding: "5px 10px" }}>
              {s}
            </span>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          Pas encore d&apos;analyse — connectez un compte puis relancez l&apos;analyse.
        </p>
      )}
    </div>
  );
}
