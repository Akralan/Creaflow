"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type MaterialEvent, type MaterialEventKind } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/**
 * Ligne de temps d'un sujet (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3) : ce que le lecteur
 * d'événements a trouvé dans la matière, dans l'ordre des dates, corrigeable, plus ce que l'auteur
 * ajoute lui-même. Lot 0 : une liste, un bouton « Relire la matière », un ajout à la main.
 */

const KIND_LABELS: Record<MaterialEventKind, string> = {
  failure: "Échec",
  decision: "Décision",
  result: "Résultat",
  feedback: "Retour",
  milestone: "Étape",
};

const KIND_COLORS: Record<MaterialEventKind, string> = {
  failure: "oklch(0.55 0.18 25)",
  decision: "oklch(0.5 0.2 292)",
  result: "oklch(0.45 0.14 150)",
  feedback: "oklch(0.5 0.13 60)",
  milestone: "oklch(0.5 0.1 230)",
};

function formatEventDate(event: MaterialEvent): string {
  if (!event.date || event.datePrecision === "unknown") return "sans date";
  const d = new Date(`${event.date}T00:00:00.000Z`);
  if (event.datePrecision === "month") return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export default function EventTimeline({ productId }: { productId: string }) {
  const [events, setEvents] = useState<MaterialEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ date: "", title: "", whatHappened: "", whatChanged: "", kind: "milestone" as MaterialEventKind });
  const [saving, setSaving] = useState(false);

  async function reload() {
    const { events: next, unreadDocuments } = await api.getEvents(productId);
    setEvents(next);
    setUnread(unreadDocuments);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .getEvents(productId)
      .then(({ events: next, unreadDocuments }) => {
        if (cancelled) return;
        setEvents(next);
        setUnread(unreadDocuments);
        setLoaded(true);
      })
      .catch(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function readNow() {
    setReading(true);
    setError(null);
    setNotice(null);
    try {
      const { report } = await api.readEvents(productId);
      await reload();
      setNotice(
        report.documents === 0
          ? "Tout est déjà lu."
          : `${report.documentsRead} document${report.documentsRead > 1 ? "s" : ""} lu${report.documentsRead > 1 ? "s" : ""}, ${report.eventsSaved} événement${report.eventsSaved > 1 ? "s" : ""} trouvé${report.eventsSaved > 1 ? "s" : ""}${report.stoppedAtMaxTurns ? " — lecture interrompue, relance pour finir." : "."}`
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Lecture impossible, réessaie.");
    } finally {
      setReading(false);
    }
  }

  async function addEvent() {
    if (!draft.title.trim() || !draft.whatHappened.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.createEvent({
        productId,
        date: draft.date,
        datePrecision: draft.date ? "day" : "unknown",
        title: draft.title,
        whatHappened: draft.whatHappened,
        whatChanged: draft.whatChanged || undefined,
        kind: draft.kind,
      });
      setDraft({ date: "", title: "", whatHappened: "", whatChanged: "", kind: "milestone" });
      setAdding(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Suppression impossible.");
    }
  }

  if (!loaded) return null;

  const inputStyle = {
    width: "100%",
    border: `1px solid ${color.inputBorder}`,
    borderRadius: 8,
    padding: "6px 8px",
    fontSize: 13,
    fontFamily: "inherit",
    background: color.inputBg,
    color: color.text,
  } as const;

  return (
    <div style={{ border: `1px solid ${color.border}`, borderRadius: 10, padding: 12, background: color.cardBg, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: color.textSecondary }}>Ligne de temps · {events.length}</div>
          <div style={{ fontSize: 12, color: color.textFaint }}>
            {unread > 0 ? `${unread} document${unread > 1 ? "s" : ""} pas encore lu${unread > 1 ? "s" : ""}.` : "Toute la matière a été lue."}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => setAdding((v) => !v)}>
            {adding ? "Annuler" : "+ Il s'est passé ça"}
          </Button>
          <Button variant="secondary" onClick={readNow} disabled={reading}>
            {reading ? "Lecture en cours…" : "Relire la matière"}
          </Button>
        </div>
      </div>

      {notice && <p style={{ margin: 0, fontSize: 12, color: color.textMuted }}>{notice}</p>}
      {error && <p style={{ margin: 0, fontSize: 13, color: color.danger }}>{error}</p>}

      {adding && (
        <div style={{ display: "grid", gap: 6, padding: 10, border: `1px solid ${color.divider}`, borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ ...inputStyle, width: 160 }} />
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as MaterialEventKind })} style={{ ...inputStyle, width: 140 }}>
              {(Object.keys(KIND_LABELS) as MaterialEventKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <input placeholder="Le moment, en une ligne" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} style={inputStyle} />
          <textarea
            placeholder="Ce qui s'est passé, avec les chiffres et les noms"
            value={draft.whatHappened}
            onChange={(e) => setDraft({ ...draft, whatHappened: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <input placeholder="Ce que ça a changé (facultatif)" value={draft.whatChanged} onChange={(e) => setDraft({ ...draft, whatChanged: e.target.value })} style={inputStyle} />
          <div>
            <Button onClick={addEvent} disabled={saving || !draft.title.trim() || !draft.whatHappened.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: color.textMuted }}>
          Rien pour l&apos;instant. La matière déposée est lue en arrière-plan ; « Relire la matière » force la lecture tout de suite.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {events.map((event) => (
            <div key={event.id} style={{ display: "grid", gap: 4, paddingLeft: 10, borderLeft: `3px solid ${KIND_COLORS[event.kind]}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: KIND_COLORS[event.kind] }}>{KIND_LABELS[event.kind]}</span>
                <span style={{ fontSize: 11, color: color.textFaint }}>{formatEventDate(event)}</span>
                {event.origin === "user" && <span style={{ fontSize: 11, color: color.textFaint }}>· écrit par toi</span>}
                {event.sourceMaterial?.title && <span style={{ fontSize: 11, color: color.textFaint }}>· {event.sourceMaterial.title}</span>}
                <button
                  onClick={() => remove(event.id)}
                  style={{ marginLeft: "auto", fontSize: 11, color: color.danger, border: "none", background: "none", cursor: "pointer" }}
                >
                  Supprimer
                </button>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{event.title}</div>
              <div style={{ fontSize: 13, color: color.text2, lineHeight: 1.45 }}>{event.whatHappened}</div>
              {event.whatChanged && (
                <div style={{ fontSize: 12, color: color.textMuted, lineHeight: 1.4 }}>
                  <span style={{ fontWeight: 600 }}>Ensuite : </span>
                  {event.whatChanged}
                </div>
              )}
              {event.audiences.length > 0 && <div style={{ fontSize: 11, color: color.textFaint }}>Pour : {event.audiences.join(", ")}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
