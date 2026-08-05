"use client";

import { useEffect, useRef, useState } from "react";
import { Link } from "lucide-react";
import { api, ApiClientError, type AssistantProposal, type OnboardingMessage, type SourceFetchError } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import IconActionButton from "@/components/ui/IconActionButton";
import { accent, color } from "@/lib/design/tokens";

const MAX_SOURCE_URLS = 3;

const GREETING: OnboardingMessage = {
  role: "assistant",
  content:
    "Salut ! Dis-moi ce qui change dans ton activité (nouveau produit, mise à jour d'un projet, retour client...) et je te proposerai des mises à jour de ton catalogue ou de ta direction éditoriale.",
};

export default function AssistantChat({ onProposalsChange }: { onProposalsChange: (proposals: AssistantProposal[]) => void }) {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlsText, setUrlsText] = useState("");
  const [sourceErrors, setSourceErrors] = useState<SourceFetchError[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { messages: history, proposals } = await api.getAssistantChat();
      setMessages(history.length > 0 ? history : [GREETING]);
      onProposalsChange(proposals);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const content = input.trim();
    if (!content || sending) return;
    const urls = urlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, MAX_SOURCE_URLS);
    setInput("");
    setUrlsText("");
    setShowUrlInput(false);
    setError(null);
    setSourceErrors([]);
    setMessages((m) => [...m, { role: "user", content }]);
    setSending(true);
    try {
      const { reply, proposals, sourceErrors } = await api.sendAssistantMessage(content, urls.length > 0 ? urls : undefined);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      onProposalsChange(proposals);
      setSourceErrors(sourceErrors ?? []);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", border: `1px solid ${color.border}`, borderRadius: 14, background: color.inputBg }}>
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
        <div ref={bottomRef} />
      </div>
      {error && <p style={{ color: color.danger, fontSize: 12, margin: "0 16px" }}>{error}</p>}
      {sourceErrors.length > 0 && (
        <p style={{ color: color.danger, fontSize: 12, margin: "0 16px" }}>
          {sourceErrors.map((s) => `${s.url} : ${s.reason}`).join(" — ")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderTop: `1px solid ${color.dividerAlt}` }}>
        {showUrlInput && (
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder="Une URL par ligne (3 max)"
            rows={2}
            style={{
              border: `1px solid ${color.inputBorder}`,
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              fontFamily: "inherit",
              background: color.cardBg,
              resize: "vertical",
            }}
          />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <IconActionButton
            icon={Link}
            variant={showUrlInput ? "primary" : "neutral"}
            title="Ajouter des liens"
            onClick={() => setShowUrlInput((v) => !v)}
            size={40}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder="Écris ton message..."
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
      </div>
    </div>
  );
}
