"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { api, ApiClientError, type AssistantAttachment, type AssistantProposal, type OnboardingMessage } from "@/lib/apiClient";
import Button from "@/components/ui/Button";
import IconActionButton from "@/components/ui/IconActionButton";
import { accent, accentAlpha, color } from "@/lib/design/tokens";

const GREETING: OnboardingMessage = {
  role: "assistant",
  content:
    "Salut ! Dis-moi ce qui change dans ton activité (nouveau produit, mise à jour d'un projet, retour client...) et je te proposerai des mises à jour de ton catalogue ou de ta direction éditoriale. Tu peux aussi glisser un fichier .md ou .txt ici pour l'ajouter à ta matière.",
};

export default function AssistantChat({ onProposalsChange }: { onProposalsChange: (proposals: AssistantProposal[]) => void }) {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<AssistantAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { messages: history, proposals, attachments: pending } = await api.getAssistantChat();
      setMessages(history.length > 0 ? history : [GREETING]);
      onProposalsChange(proposals);
      setAttachments(pending);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Le fichier est déposé tout de suite mais n'entre pas dans la matière : il attend qu'une
   *  proposition de rangement soit validée (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1). */
  async function uploadFiles(files: File[]) {
    if (files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of files) {
        const { attachment } = await api.uploadAssistantAttachment(file);
        setAttachments((a) => [...a, attachment]);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Fichier refusé, réessaie.");
    } finally {
      setUploading(false);
    }
  }

  async function discard(id: string) {
    setAttachments((a) => a.filter((x) => x.id !== id));
    try {
      await api.discardAssistantAttachment(id);
    } catch {
      // Le fichier a pu être rangé entre-temps : la liste se resynchronise au prochain message.
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
      const { reply, proposals, attachments: pending } = await api.sendAssistantMessage(content);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      onProposalsChange(proposals);
      setAttachments(pending);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur, réessaie.");
    } finally {
      setSending(false);
    }
  }

  if (loading) return null;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        // Ne pas éteindre la surbrillance en survolant un enfant de la zone.
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        uploadFiles(Array.from(e.dataTransfer.files));
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: `1px solid ${dragging ? accent : color.border}`,
        borderRadius: 14,
        background: dragging ? accentAlpha(0.06) : color.inputBg,
        transition: "background 120ms, border-color 120ms",
      }}
    >
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
        {sending && <div style={{ alignSelf: "flex-start", fontSize: 13, color: color.textFaint, padding: "0 4px" }}>...</div>}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ color: color.danger, fontSize: 12, margin: "0 16px" }}>{error}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, borderTop: `1px solid ${color.dividerAlt}` }}>
        {attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {attachments.map((a) => (
              <span
                key={a.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: color.textMuted,
                  background: color.cardBg,
                  border: `1px solid ${color.border}`,
                  borderRadius: 20,
                  padding: "4px 6px 4px 10px",
                }}
              >
                <Paperclip size={12} />
                {a.filename}
                <button
                  onClick={() => discard(a.id)}
                  title="Retirer ce fichier"
                  style={{ display: "flex", border: "none", background: "none", cursor: "pointer", color: color.textFaint, padding: 2 }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            multiple
            style={{ display: "none" }}
            onChange={(e) => {
              uploadFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <IconActionButton
            icon={Paperclip}
            variant="neutral"
            title="Joindre un fichier .md ou .txt"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            size={40}
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={
              attachments.length > 0 ? "Dis-lui quoi faire de ce fichier..." : "Écris ton message..."
            }
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
