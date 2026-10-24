"use client";

import { useEffect, useRef, useState } from "react";
import AppIcon from "@/components/app/AppIcon";
import { api, ApiClientError, type ConnectRepoResult, type SourceCandidate, type SourceReadingStatus } from "@/lib/apiClient";
import { destinationLabel, summarizePanel, type PanelProduct } from "@/components/app/sourcePanelLogic";

/**
 * Brancher une source depuis Business context (docs/SPEC_RATTACHEMENT_SOURCES.md) : une ligne par
 * candidat, cocher ouvre les projets existants sous la ligne (celui de l'écran déjà choisi), un
 * bouton qui dit où tout part, puis la lecture ligne par ligne et un bilan en une ligne.
 *
 * On ne crée jamais de projet ici : une source rejoint toujours un projet existant. Le composant ne
 * sait rien du fournisseur — titres, sous-titres et textes viennent de la route, qui les tient du
 * connecteur.
 */

const POLL_MS = 3000;

function initials(text: string): string {
  const letters = text.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  return letters ? letters.slice(0, 2).replace(/^./, (c) => c.toUpperCase()) : "·";
}

type Phase = "pick" | "adding" | "reading" | "done";

export default function SourcePanel({
  provider,
  products,
  defaultProductId,
  onClose,
  onChanged,
}: {
  provider: string;
  products: PanelProduct[];
  /** Le projet que l'écran affiche : destination de toute ligne cochée tant qu'on n'en choisit pas une autre. */
  defaultProductId: string;
  onClose: () => void;
  /** Appelé quand des sources ont été branchées : l'écran recharge sa carte Sources. */
  onChanged: () => void;
}) {
  const [candidates, setCandidates] = useState<SourceCandidate[]>([]);
  const [texts, setTexts] = useState({ displayName: "", emptyMessage: "", footnote: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** externalId → projet choisi. */
  const [selection, setSelection] = useState<Map<string, string>>(new Map());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [results, setResults] = useState<ConnectRepoResult[]>([]);
  const [statuses, setStatuses] = useState<Map<string, SourceReadingStatus>>(new Map());
  const changed = useRef(false);

  // `loading` part à vrai et le composant est remonté par fournisseur (key={provider}) : pas de
  // remise à zéro ici.
  useEffect(() => {
    let cancelled = false;
    api
      .getSourceCandidates(provider)
      .then((data) => {
        if (cancelled) return;
        setCandidates(data.candidates);
        setTexts({ displayName: data.displayName, emptyMessage: data.emptyMessage, footnote: data.footnote });
      })
      .catch((err) => !cancelled && setError(err instanceof ApiClientError ? err.message : "Couldn't read your sources."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [provider]);

  // Pendant la lecture : l'état de chaque source branchée, toutes les 3 s, jusqu'à ce que tout soit lu.
  // Le sondage ne survit pas au démontage du composant.
  useEffect(() => {
    if (phase !== "reading") return;
    let cancelled = false;
    async function tick() {
      const ok = results.filter((r) => !r.error);
      const entries = await Promise.all(
        ok.map(async (r) => [r.sourceId, await api.getMaterialSourceStatus(r.sourceId).catch(() => null)] as const)
      );
      if (cancelled) return;
      const next = new Map(statuses);
      for (const [id, status] of entries) if (status) next.set(id, status);
      setStatuses(next);
      if (summarizePanel(ok, next, products).finished) setPhase("done");
    }
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // `statuses` est relu dans tick mais ne doit pas relancer l'effet : c'est l'intervalle qui rythme.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, results, products]);

  function toggle(candidate: SourceCandidate) {
    if (candidate.connectedTo || phase !== "pick") return;
    const next = new Map(selection);
    if (next.has(candidate.externalId)) {
      next.delete(candidate.externalId);
      setMenuFor(null);
    } else {
      next.set(candidate.externalId, defaultProductId);
      // Avec un seul projet dans le compte, il n'y a rien à choisir : pas de blocs.
      setMenuFor(products.length > 1 ? candidate.externalId : null);
    }
    setSelection(next);
  }

  function pick(externalId: string, productId: string) {
    const next = new Map(selection);
    next.set(externalId, productId);
    setSelection(next);
    setMenuFor(null);
  }

  async function add() {
    const chosen = candidates
      .filter((c) => selection.has(c.externalId))
      .map((c) => ({ ...c, productId: selection.get(c.externalId) ?? defaultProductId }));
    if (chosen.length === 0) return;
    setPhase("adding");
    setError(null);
    try {
      const { results } = await api.connectSources(provider, chosen);
      changed.current = true;
      onChanged();
      setResults(results);
      setStatuses(new Map());
      setPhase("reading");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't pull the material.");
      setPhase("pick");
    }
  }

  function addMore() {
    setSelection(new Map());
    setMenuFor(null);
    setResults([]);
    setStatuses(new Map());
    setPhase("pick");
    setLoading(true);
    api
      .getSourceCandidates(provider)
      .then((data) => setCandidates(data.candidates))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Couldn't read your sources."))
      .finally(() => setLoading(false));
  }

  const selected = [...selection.entries()].map(([externalId, productId]) => ({ externalId, productId }));
  const summary = summarizePanel(results, statuses, products);
  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "this project";

  if (phase === "done") {
    return (
      <section className="card pick" aria-label={texts.displayName}>
        <div className="pk-done">
          <div>
            <p className="k">{texts.displayName}</p>
            <h2>
              {summary.added} {summary.added > 1 ? "sources" : "source"} added to {summary.target}.
            </h2>
            <p className="sub">
              {summary.events} events found. Your next posts can tell them.
              {summary.failed > 0 && ` ${summary.failed} could not be read — try again from Settings.`}
            </p>
          </div>
          <div className="acts">
            <button className="link" type="button" onClick={addMore}>
              Add more
            </button>
            <button className="tbtn" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </section>
    );
  }

  const selectable = candidates.filter((c) => !c.connectedTo);
  const busy = phase === "adding" || phase === "reading";

  return (
    <section className="card pick" aria-label={`Add from ${texts.displayName}`}>
      <div className="pick-head">
        <div>
          <p className="k">{texts.displayName ? `${texts.displayName} · connected` : "Connected"}</p>
          <h2>What should Tellovo read?</h2>
          <p className="sub">What you pick joins the project you choose. Tellovo reads it, then your next posts can tell it.</p>
        </div>
        <button className="tbtn" type="button" onClick={onClose} disabled={busy}>
          Close
        </button>
      </div>

      {error && (
        <p className="err" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className="sub" style={{ marginTop: 14 }}>
          Reading your {texts.displayName || "sources"}…
        </p>
      ) : candidates.length === 0 ? (
        <p className="sub" style={{ marginTop: 14 }}>
          {texts.emptyMessage}
        </p>
      ) : (
        <>
          <div className="pk-list" role="group" aria-label="Sources to add">
            {candidates.map((c, i) => {
              const on = selection.has(c.externalId);
              const off = Boolean(c.connectedTo);
              const result = busy ? results[selected.findIndex((s) => s.externalId === c.externalId)] : undefined;
              const status = result && !result.error ? statuses.get(result.sourceId) : undefined;
              let right: React.ReactNode = null;
              if (off) right = <span className="pk-static">in {c.connectedTo!.productName}</span>;
              else if (phase === "adding" && on) right = <span className="status writing">Reading…</span>;
              else if (phase === "reading" && on && result) {
                if (result.error) right = <span className="status err-txt">{result.error}</span>;
                else if (status && status.unread === 0) right = <span className="status done">{status.events} events found</span>;
                else right = <span className="status writing">Reading…</span>;
              } else if (on) {
                const name = productName(selection.get(c.externalId) ?? defaultProductId);
                right = (
                  <span className="pk-to">
                    <span className="mini" aria-hidden="true">
                      {initials(name)}
                    </span>
                    {name}
                  </span>
                );
              }
              return (
                <div key={c.externalId ?? i} className={`pk-row${off ? " off" : ""}${on ? " on" : ""}`}>
                  <button
                    type="button"
                    className="pk-hit"
                    role="checkbox"
                    aria-checked={on}
                    aria-disabled={off || busy}
                    aria-label={c.subjectName}
                    onClick={() => !busy && toggle(c)}
                  >
                    <span className="pk-check" aria-hidden="true">
                      <AppIcon name="check" small />
                    </span>
                    <span className="src-ic">
                      <AppIcon name={provider === "github" ? "github" : provider === "linear" ? "list" : "doc"} />
                    </span>
                    <span className="pk-txt">
                      <b>{c.subjectName}</b>
                      {(c.hint || c.subjectDescription) && <span>{c.hint ?? c.subjectDescription}</span>}
                    </span>
                  </button>
                  <span className="pk-right">{right}</span>
                  {menuFor === c.externalId && on && phase === "pick" && (
                    <div className="pk-menu" role="group" aria-label={`Add « ${c.subjectName} » to one of your projects`}>
                      <p className="k">Add « {c.subjectName} » to one of your projects</p>
                      {products.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className={`pk-cube${selection.get(c.externalId) === p.id ? " on" : ""}`}
                          onClick={() => pick(c.externalId, p.id)}
                        >
                          <span className="logo" aria-hidden="true">
                            {initials(p.name)}
                          </span>
                          <b>{p.name}</b>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pk-foot">
            <span className="k">
              {busy
                ? `Reading ${selected.length} ${selected.length > 1 ? "sources" : "source"}, one after the other. You can leave this screen.`
                : selectable.length === 0
                  ? `Everything from ${texts.displayName} is already connected.`
                  : selected.length === 0
                    ? texts.footnote || "Pick what Tellovo should read."
                    : `${selected.length} selected. ${texts.footnote}`}
            </span>
            {!busy && selectable.length > 0 && (
              <button className="btn btn-ink btn-sm" type="button" onClick={add} disabled={selected.length === 0}>
                {destinationLabel(selected, products, defaultProductId)}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
