"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type MaterialEvent } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

/**
 * La ligne de temps d'un sujet (docs/SPEC_EVENEMENT_POINTEUR.md §2) : des POINTEURS, un par ligne de
 * document où il s'est passé quelque chose. Un document, une ligne, une date — rien d'autre à
 * afficher, et rien à corriger : un pointeur n'a pas de champ.
 *
 * L'ajout et l'édition à la main ont été retirés avec le chantier. On ajoute de la matière, pas des
 * adresses. Reste la relecture, et la suppression d'un pointeur qu'on ne veut plus voir choisi.
 */

function formatPointerDate(event: MaterialEvent): string {
  if (!event.date) return "no date";
  return new Date(`${event.date}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function EventTimeline({ productId }: { productId: string }) {
  const [events, setEvents] = useState<MaterialEvent[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [reading, setReading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          ? "Everything has already been read."
          : `${report.documentsRead} document${report.documentsRead > 1 ? "s" : ""} read, ${report.pointers} pointer${report.pointers > 1 ? "s" : ""} found${report.failed > 0 ? ` — ${report.failed} document${report.failed > 1 ? "s" : ""} failed, run it again.` : "."}`
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't read the material, please try again.");
    } finally {
      setReading(false);
    }
  }

  async function removePointer(id: string) {
    setError(null);
    try {
      await api.deleteEvent(id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't delete that pointer.");
    }
  }

  if (!loaded) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: color.textSecondary }}>Timeline · {events.length}</div>
        <Button variant="secondary" onClick={readNow} disabled={reading}>
          {reading ? "Reading…" : unread > 0 ? `Read ${unread} new document${unread > 1 ? "s" : ""}` : "Re-read the material"}
        </Button>
      </div>

      {notice ? <div style={{ fontSize: 13, color: color.textSecondary }}>{notice}</div> : null}
      {error ? <div style={{ fontSize: 13, color: "oklch(0.55 0.18 25)" }}>{error}</div> : null}

      {events.length === 0 ? (
        <div style={{ fontSize: 13, color: color.textSecondary }}>
          No pointer yet. Add material to this subject, then read it.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {events.map((event) => (
            <li
              key={event.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                fontSize: 13,
                padding: "6px 0",
                borderBottom: `1px solid ${color.border}`,
              }}
            >
              <span style={{ minWidth: 130, color: color.textSecondary, fontVariantNumeric: "tabular-nums" }}>
                {formatPointerDate(event)}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", flex: 1 }}>
                {event.sourceMaterial?.title ?? "document"}:{event.line}
              </span>
              <button
                onClick={() => removePointer(event.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: color.textSecondary, fontSize: 12 }}
                aria-label={`Remove the pointer on line ${event.line}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
