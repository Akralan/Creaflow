"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiClientError, type OnboardingMessage, type OnboardingSeriesProposal } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import SeriesPicker from "@/components/SeriesPicker";
import { accent, color } from "@/lib/design/tokens";

const GREETING: OnboardingMessage = {
  role: "assistant",
  content:
    "Salut ! Je suis ton assistant CreaFlow. Pour commencer, en quelques mots : sur quoi travailles-tu, ou que proposes-tu ?",
};

export default function OnboardingChat({ onComplete }: { onComplete: () => void }) {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  // Fin de discussion atteinte À CE tour : les séries générées s'affichent en sélection et on
  // laisse choisir celles à garder au lieu d'avancer d'office. Une session déjà complète au
  // rechargement, elle, avance directement — le choix a déjà été offert.
  const [justCompleted, setJustCompleted] = useState(false);
  const [proposedSeries, setProposedSeries] = useState<OnboardingSeriesProposal[]>([]);
  const [keptIds, setKeptIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { messages: history, complete } = await api.getOnboardingChat();
      setMessages(history.length > 0 ? history : [GREETING]);
      setLoading(false);
      if (complete) onComplete();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, justCompleted]);

  function toggleSeries(id: string) {
    setKeptIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleContinue() {
    if (applying) return;
    // Tout est gardé → rien à archiver, pas d'appel réseau.
    if (proposedSeries.length === 0 || keptIds.size === proposedSeries.length) {
      onComplete();
      return;
    }
    setApplying(true);
    setError(null);
    try {
      await api.applyOnboardingSeriesSelection([...keptIds]);
      onComplete();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
      setApplying(false);
    }
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);
    try {
      const { reply, complete, series } = await api.sendOnboardingMessage(content);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (complete) {
        setProposedSeries(series);
        setKeptIds(new Set(series.map((s) => s.id))); // tout coché par défaut
        setJustCompleted(true);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 440, border: `1px solid ${color.border}`, borderRadius: 14, background: color.inputBg }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "78%",
              background: m.role === "user" ? accent : color.cardBg,
              color: m.role === "user" ? "#fff" : color.text2,
              border: m.role === "user" ? "none" : `1px solid ${color.border}`,
              borderRadius: 14,
              padding: "10px 14px",
              fontSize: 14,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div style={{ alignSelf: "flex-start", fontSize: 13, color: color.textFaint, padding: "0 4px" }}>...</div>
        )}
        {justCompleted && proposedSeries.length > 0 && (
          <SeriesPicker series={proposedSeries} selectedIds={keptIds} onToggle={toggleSeries} />
        )}
        <div ref={bottomRef} />
      </div>
      {error && <p style={{ color: color.danger, fontSize: 12, margin: "0 16px" }}>{error}</p>}
      {justCompleted ? (
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 14,
            borderTop: `1px solid ${color.dividerAlt}`,
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          {proposedSeries.length > 0 && (
            <span style={{ fontSize: 13, color: keptIds.size === 0 ? color.danger : color.textMuted }}>
              {keptIds.size === 0
                ? "Garde au moins une série pour continuer"
                : `${keptIds.size}/${proposedSeries.length} série${keptIds.size > 1 ? "s" : ""} gardée${keptIds.size > 1 ? "s" : ""}`}
            </span>
          )}
          <Button onClick={handleContinue} disabled={applying || (proposedSeries.length > 0 && keptIds.size === 0)}>
            {applying ? "..." : "Continuer"}
          </Button>
        </div>
      ) : (
      <div style={{ display: "flex", gap: 8, padding: 14, borderTop: `1px solid ${color.dividerAlt}` }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Écris ta réponse..."
          style={{
            flex: 1,
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            background: color.cardBg,
          }}
        />
        <Button onClick={handleSend} disabled={sending || !input.trim()} style={{ padding: "10px 18px" }}>
          {sending ? "..." : "Envoyer"}
        </Button>
      </div>
      )}
    </div>
  );
}
