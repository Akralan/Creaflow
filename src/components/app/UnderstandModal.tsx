"use client";

import { useEffect, useState } from "react";
import AppIcon from "@/components/app/AppIcon";
import { api, ApiClientError, type EventSummary, type PortraitReader } from "@/lib/apiClient";
import { sortGenreCounts } from "@/components/app/projectInsight";

/**
 * « Understand it » (docs/SPEC_COMPRENDRE_LE_PROJET.md) : ce que Tellovo a compris du projet, dans
 * une modale de Business context. Les publics du portrait des lecteurs, et combien d'événements de
 * chaque genre la lecture de la matière a trouvés. Lecture seule.
 */
export default function UnderstandModal({
  productId,
  name,
  readers,
  onClose,
}: {
  productId: string;
  name: string;
  readers: PortraitReader[];
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<EventSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getEventSummary(productId)
      .then((s) => !cancelled && setSummary(s))
      .catch((err) => !cancelled && setError(err instanceof ApiClientError ? err.message : "Couldn't count the events."));
    return () => {
      cancelled = true;
    };
  }, [productId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = summary ? sortGenreCounts(summary.byGenre) : [];
  const max = rows[0]?.count ?? 0;

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="ap-understand-title">
      <button className="scrim" type="button" aria-label="Close" onClick={onClose} />
      <div className="modal modal-understand">
        <button className="xbtn" type="button" aria-label="Close" onClick={onClose}>
          <AppIcon name="x" />
        </button>
        <h2 id="ap-understand-title">
          How Tellovo understands {name}. <span>What your posts are built from.</span>
        </h2>

        <section className="und-sec" aria-labelledby="und-readers">
          <h3 id="und-readers">Who you write for</h3>
          {readers.length === 0 ? (
            <p className="und-empty">No audience yet. Tellovo draws it from your project once its material has been read.</p>
          ) : (
            <div className="und-readers">
              {readers.map((r) => (
                <article className="und-reader" key={r.label}>
                  <b>{r.label}</b>
                  <p>{r.who}</p>
                  <dl>
                    {r.wants && (
                      <div>
                        <dt>Wants</dt>
                        <dd>{r.wants}</dd>
                      </div>
                    )}
                    {r.stopsFor && (
                      <div>
                        <dt>Stops scrolling for</dt>
                        <dd>{r.stopsFor}</dd>
                      </div>
                    )}
                    {r.turnsOff && (
                      <div>
                        <dt>Turned off by</dt>
                        <dd>{r.turnsOff}</dd>
                      </div>
                    )}
                  </dl>
                  {r.words.length > 0 && (
                    <div className="und-words" aria-label="Their words">
                      {r.words.map((w) => (
                        <span key={w}>{w}</span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="und-sec" aria-labelledby="und-events">
          <h3 id="und-events">
            What Tellovo found in your material
            {summary && <span className="und-total">{summary.total} events</span>}
          </h3>
          {error && <p className="err">{error}</p>}
          {!summary && !error && <p className="und-empty">Counting…</p>}
          {summary && rows.length === 0 && (
            <p className="und-empty">
              {summary.unreadDocuments > 0 ? "Tellovo is still reading your material." : "No event found yet. Connect a source so Tellovo has something to read."}
            </p>
          )}
          {rows.length > 0 && (
            <ul className="und-bars">
              {rows.map((r) => (
                <li key={r.genre}>
                  <span className="und-lab">{r.label}</span>
                  <span className="und-bar" aria-hidden="true">
                    <i style={{ width: `${Math.max(2, Math.round((r.count / max) * 100))}%` }} />
                  </span>
                  <span className="und-n">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
          {summary && summary.unreadDocuments > 0 && rows.length > 0 && (
            <p className="und-note">
              {summary.unreadDocuments} {summary.unreadDocuments > 1 ? "documents are" : "document is"} still being read.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
