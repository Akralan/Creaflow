"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type Inspiration } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

const DISMISSED_BY: Record<string, string> = {
  model: "the writer",
  user: "you",
  system: "the system",
};

const DATE = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });

/**
 * Inspiration research for a topic (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.4): what the research found on
 * the web, fed back into the prompts of the following posts. Dismissed cards stay visible with the
 * reason, and can be restored in one click.
 */
export default function InspirationsPanel({ productId }: { productId: string }) {
  const [list, setList] = useState<Inspiration[] | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInspirations(productId)
      .then((r) => {
        setList(r.inspirations);
        setRefreshedAt(r.refreshedAt);
      })
      .catch(() => setError("Couldn't load the inspirations."));
  }, [productId]);

  async function research() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.runInspirationResearch(productId);
      setList(r.inspirations);
      setRefreshedAt(r.refreshedAt);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "The research failed.");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: () => Promise<unknown>, next: (list: Inspiration[]) => Inspiration[]) {
    setError(null);
    try {
      await action();
      setList((cur) => (cur ? next(cur) : cur));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong while saving.");
    }
  }

  const active = list?.filter((i) => i.status === "active") ?? [];
  const dismissed = list?.filter((i) => i.status === "dismissed") ?? [];

  const linkStyle: React.CSSProperties = { color: color.text, fontWeight: 600, textDecoration: "underline", wordBreak: "break-word" };
  const smallButton: React.CSSProperties = { fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0 };

  function card(i: Inspiration) {
    const meta = [i.kind, i.readerLabel, i.platform].filter(Boolean).join(" · ");
    const muted = i.status === "dismissed";
    return (
      <div key={i.id} style={{ border: `1px solid ${color.border}`, borderRadius: 10, padding: 10, fontSize: 13, display: "grid", gap: 4, opacity: muted ? 0.65 : 1 }}>
        <a href={i.url} target="_blank" rel="noreferrer" style={linkStyle}>
          {i.title}
        </a>
        <div style={{ color: color.textSecondary }}>{i.insight}</div>
        <div style={{ color: color.textMuted, fontSize: 12 }}>
          {meta}
          {i.usedCount > 0 && ` · used ${i.usedCount} time${i.usedCount > 1 ? "s" : ""}`}
          {muted && i.dismissedBy && ` · dismissed by ${DISMISSED_BY[i.dismissedBy] ?? i.dismissedBy}${i.dismissReason ? `: ${i.dismissReason}` : ""}`}
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {muted ? (
            <button
              style={{ ...smallButton, color: color.text3 }}
              onClick={() =>
                act(i.id, () => api.setInspirationStatus(i.id, "active"), (cur) =>
                  cur.map((x) => (x.id === i.id ? { ...x, status: "active", dismissedBy: null, dismissReason: null } : x))
                )
              }
            >
              Restore
            </button>
          ) : (
            <button
              style={{ ...smallButton, color: color.text3 }}
              onClick={() =>
                act(i.id, () => api.setInspirationStatus(i.id, "dismissed"), (cur) =>
                  cur.map((x) => (x.id === i.id ? { ...x, status: "dismissed", dismissedBy: "user", dismissReason: "Dismissed by hand." } : x))
                )
              }
            >
              Dismiss
            </button>
          )}
          <button style={{ ...smallButton, color: color.danger }} onClick={() => act(i.id, () => api.deleteInspiration(i.id), (cur) => cur.filter((x) => x.id !== i.id))}>
            Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary }}>
          Inspirations
          <span style={{ fontWeight: 400, color: color.textMuted }}>
            {refreshedAt ? ` · last research on ${DATE.format(new Date(refreshedAt))}` : " · no research yet"}
          </span>
        </div>
        <Button variant="secondary" onClick={research} disabled={busy}>
          {busy ? "Researching… (1 to 2 min)" : "Run research"}
        </Button>
      </div>
      <p style={{ fontSize: 12, color: color.textMuted, margin: 0 }}>
        What already works for this topic&apos;s readers, found on the web. The writer takes inspiration from it for the shape of posts, never for facts, and can dismiss a card that isn&apos;t useful.
      </p>
      {list === null && !error && <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>Loading…</p>}
      {list !== null && active.length === 0 && <p style={{ fontSize: 13, color: color.textMuted, margin: 0 }}>No active cards.</p>}
      {active.map(card)}
      {dismissed.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, marginTop: 4 }}>Dismissed</div>
          {dismissed.map(card)}
        </>
      )}
      {error && <span style={{ fontSize: 12, color: color.danger }}>{error}</span>}
    </div>
  );
}
