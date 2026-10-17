"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  api,
  ApiClientError,
  type ContentSeries,
  type FramingChoice,
  type FramingDimension,
  type FramingSignature,
  type ProposedFramingOption,
} from "@/lib/apiClient";
import { accentAlpha, color } from "@/lib/design/tokens";

type Step = FramingDimension | "signature";

const STEPS: Array<{ id: Step; title: string; question: string }> = [
  { id: "posture", title: "1. La posture", question: "D'où parles-tu au lecteur dans cette série ?" },
  { id: "voice", title: "2. La voix", question: "Avec quels mots ?" },
  { id: "story", title: "3. Le récit", question: "Comment un épisode avance-t-il ?" },
  { id: "signature", title: "4. La signature", question: "Ce qui reviendra à chaque épisode." },
];

const PLACEMENT_LABEL: Record<FramingSignature["placement"], string> = { ouverture: "en ouverture", fin: "en fin de post", titre: "dans le titre" };

type Picked = { id: string; sample: string; label: string };
type Rejected = { dimension: FramingDimension; id: string; sample: string };

/**
 * Cadrage d'une série par des choix (docs/SPEC_CADRAGE_SERIE.md §5) : trois étapes de trois cartes
 * écrites sur un vrai moment de la matière, puis une signature proposée. Aucun état serveur pendant
 * le parcours ; l'enregistrement final écrit le cadrage.
 */
export default function SeriesFramingPanel({ series, onSeriesUpdate }: { series: ContentSeries; onSeriesUpdate: (series: ContentSeries) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("posture");
  const [moment, setMoment] = useState<{ title: string; docIds: string[]; hasMaterial: boolean } | null>(null);
  const [options, setOptions] = useState<ProposedFramingOption[]>([]);
  const [seen, setSeen] = useState<Record<FramingDimension, string[]>>({ posture: [], voice: [], story: [] });
  const [chosen, setChosen] = useState<{ posture?: Picked; voice?: Picked | null; story?: Picked }>({});
  const [rejected, setRejected] = useState<Rejected[]>([]);
  const [remark, setRemark] = useState("");
  const [remarks, setRemarks] = useState<string[]>([]);
  const [accountVoice, setAccountVoice] = useState<FramingChoice | null>(null);
  const [voiceMode, setVoiceMode] = useState<"ask" | "adjust">("ask");
  const [signature, setSignature] = useState<(FramingSignature & { why: string }) | null>(null);
  const [withSignature, setWithSignature] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const framing = series.framing;

  async function load(dimension: FramingDimension, next: typeof chosen, exclude: string[] = [], freshMoment = false) {
    setBusy(true);
    setError(null);
    setOptions([]);
    try {
      const r = await api.getFramingOptions(series.id, {
        dimension,
        chosen: { posture: next.posture ? { id: next.posture.id, sample: next.posture.sample } : null, voice: next.voice ? { id: next.voice.id, sample: next.voice.sample } : null },
        excludeIds: exclude,
        remark: remark.trim() || undefined,
        moment: moment && !freshMoment ? { title: moment.title, docIds: moment.docIds } : undefined,
      });
      if (remark.trim()) setRemarks((cur) => [...cur, remark.trim()]);
      setRemark("");
      setMoment(r.moment);
      setAccountVoice(r.accountVoice);
      setOptions(r.options);
      setSeen((cur) => ({ ...cur, [dimension]: [...new Set([...cur[dimension], ...r.options.map((o) => o.id)])] }));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Impossible de préparer les propositions.");
    } finally {
      setBusy(false);
    }
  }

  async function loadSignature(next: typeof chosen) {
    if (!next.posture || !next.story) return;
    setBusy(true);
    setError(null);
    try {
      setSignature(
        await api.getFramingSignature(series.id, {
          posture: { id: next.posture.id, sample: next.posture.sample },
          voice: next.voice ? { id: next.voice.id, sample: next.voice.sample } : null,
          story: { id: next.story.id, sample: next.story.sample },
        })
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Impossible de proposer une signature.");
    } finally {
      setBusy(false);
    }
  }

  function start() {
    setOpen(true);
    setStep("posture");
    setChosen({});
    setMoment(null);
    setRejected([]);
    setRemarks([]);
    setSeen({ posture: [], voice: [], story: [] });
    setSignature(null);
    setWithSignature(true);
    setVoiceMode("ask");
    void load("posture", {}, [], true);
  }

  function pick(dimension: FramingDimension, option: ProposedFramingOption) {
    setRejected((cur) => [...cur, ...options.filter((o) => o.id !== option.id).map((o) => ({ dimension, id: o.id, sample: o.sample }))]);
    const next = { ...chosen, [dimension]: { id: option.id, sample: option.sample, label: option.label } };
    setChosen(next);
    if (dimension === "posture") {
      setStep("voice");
      // Voix déjà choisie pour le compte : on demande d'abord si on la garde.
      if (accountVoice) {
        setVoiceMode("ask");
        setOptions([]);
      } else {
        void load("voice", next);
      }
    } else if (dimension === "voice") {
      setStep("story");
      void load("story", next);
    } else {
      setStep("signature");
      void loadSignature(next);
    }
  }

  function keepAccountVoice() {
    const next = { ...chosen, voice: null };
    setChosen(next);
    setStep("story");
    void load("story", next);
  }

  function back() {
    setError(null);
    if (step === "voice") {
      setStep("posture");
      void load("posture", {}, []);
    } else if (step === "story") {
      setStep("voice");
      if (accountVoice) {
        setVoiceMode("ask");
        setOptions([]);
      } else void load("voice", { posture: chosen.posture });
    } else if (step === "signature") {
      setStep("story");
      void load("story", chosen);
    }
  }

  async function save() {
    if (!moment || !chosen.posture || !chosen.story) return;
    setBusy(true);
    setError(null);
    try {
      const { series: updated } = await api.saveFraming(series.id, {
        moment: { title: moment.title, docIds: moment.docIds },
        posture: { id: chosen.posture.id, sample: chosen.posture.sample },
        voice: chosen.voice ? { id: chosen.voice.id, sample: chosen.voice.sample } : null,
        story: { id: chosen.story.id, sample: chosen.story.sample },
        signature: withSignature && signature?.text.trim() ? { text: signature.text.trim(), placement: signature.placement } : null,
        rejected,
        remarks,
      });
      onSeriesUpdate(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Impossible d'enregistrer le cadrage.");
    } finally {
      setBusy(false);
    }
  }

  const box: React.CSSProperties = {
    background: accentAlpha(0.05),
    border: `1px solid ${accentAlpha(0.22)}`,
    borderRadius: 14,
    padding: "16px 18px",
    marginBottom: 14,
  };

  if (!open) {
    return (
      <div style={box}>
        {framing ? (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: color.text2 }}>
              <div style={{ fontWeight: 700, color: color.text, marginBottom: 2 }}>Cadrage de la série</div>
              <div>
                <b>Posture</b> : {framing.posture.label} · <b>Voix</b> : {framing.voice ? `${framing.voice.label} (pour cette série)` : "ta voix habituelle"} · <b>Récit</b> : {framing.story.label}
              </div>
              {framing.signature && (
                <div>
                  <b>Signature</b> {PLACEMENT_LABEL[framing.signature.placement]} : « {framing.signature.text} »
                </div>
              )}
            </div>
            <Button variant="secondary" onClick={start}>
              Recadrer
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: color.text2 }}>
              <div style={{ fontWeight: 700, color: color.text }}>Avant le premier épisode, choisis comment tu veux le raconter.</div>
              Trois choix, trois propositions à chaque fois, écrites à partir de ta vraie matière.
            </div>
            <Button onClick={start}>Cadrer la série</Button>
          </div>
        )}
      </div>
    );
  }

  const current = STEPS.find((s) => s.id === step)!;
  const dimension = step === "signature" ? null : step;

  return (
    <div style={box}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {STEPS.map((s) => (
          <span
            key={s.id}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 999,
              background: s.id === step ? accentAlpha(0.16) : "transparent",
              color: s.id === step ? color.text : color.textMuted,
              border: `1px solid ${s.id === step ? accentAlpha(0.35) : color.border}`,
            }}
          >
            {s.title}
            {s.id !== "signature" && chosen[s.id] ? ` · ${chosen[s.id]?.label}` : ""}
            {s.id === "voice" && chosen.voice === null && step !== "voice" ? " · ta voix" : ""}
          </span>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 15, color: color.text, marginBottom: 4 }}>{current.question}</div>
      {moment && (
        <p style={{ fontSize: 12, color: color.textMuted, margin: "0 0 12px" }}>
          Le même moment raconté de trois façons : <i>{moment.title}</i>
          {!moment.hasMaterial && " — pas encore de matière sur ce sujet, extraits écrits à partir de sa description."}
        </p>
      )}

      {step === "voice" && accountVoice && voiceMode === "ask" && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <Button onClick={keepAccountVoice} disabled={busy}>
            Garder ma voix : {accountVoice.label}
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setVoiceMode("adjust");
              void load("voice", chosen);
            }}
          >
            L&apos;ajuster pour cette série
          </Button>
        </div>
      )}

      {dimension && busy && <p style={{ fontSize: 13, color: color.textMuted }}>J&apos;écris trois propositions…</p>}

      {dimension && !busy && options.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 12 }}>
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => pick(dimension, o)}
              style={{
                textAlign: "left",
                background: color.cardBg,
                border: `1px solid ${color.border}`,
                borderRadius: 12,
                padding: 14,
                cursor: "pointer",
                display: "grid",
                gap: 6,
                alignContent: "start",
                font: "inherit",
                color: color.text,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14 }}>{o.label}</span>
              <span style={{ fontSize: 12, color: color.textMuted }}>{o.description}</span>
              <span style={{ fontSize: 13, lineHeight: 1.5, color: color.text2, whiteSpace: "pre-wrap" }}>{o.sample}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "oklch(0.47 0.2 292)", marginTop: 4 }}>Choisir celle-ci →</span>
            </button>
          ))}
        </div>
      )}

      {dimension && !busy && options.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Une remarque ? (ex. « comme la 2, mais plus court »)"
            style={{
              flex: "1 1 260px",
              border: `1px solid ${color.inputBorder}`,
              borderRadius: 9,
              padding: "8px 10px",
              fontSize: 13,
              fontFamily: "inherit",
              background: color.inputBg,
              color: color.text,
            }}
          />
          <Button variant="secondary" onClick={() => load(dimension, chosen, seen[dimension])}>
            Aucune ne me va, autre chose
          </Button>
        </div>
      )}

      {step === "signature" && (
        <div style={{ display: "grid", gap: 10 }}>
          {busy && !signature && <p style={{ fontSize: 13, color: color.textMuted }}>Je cherche une signature…</p>}
          {signature && (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={signature.text}
                  disabled={!withSignature}
                  onChange={(e) => setSignature({ ...signature, text: e.target.value })}
                  style={{
                    flex: "1 1 260px",
                    border: `1px solid ${color.inputBorder}`,
                    borderRadius: 9,
                    padding: "8px 10px",
                    fontSize: 14,
                    fontFamily: "inherit",
                    background: color.inputBg,
                    color: color.text,
                  }}
                />
                <select
                  value={signature.placement}
                  disabled={!withSignature}
                  onChange={(e) => setSignature({ ...signature, placement: e.target.value as FramingSignature["placement"] })}
                  style={{ padding: "8px", borderRadius: 9, border: `1px solid ${color.inputBorder}`, fontFamily: "inherit", background: color.inputBg, color: color.text }}
                >
                  <option value="ouverture">en ouverture</option>
                  <option value="fin">en fin de post</option>
                  <option value="titre">dans le titre</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: color.textMuted, margin: 0 }}>{signature.why}</p>
              <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center", color: color.text2 }}>
                <input type="checkbox" checked={!withSignature} onChange={(e) => setWithSignature(!e.target.checked)} />
                Sans signature
              </label>
            </>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={save} disabled={busy || !chosen.posture || !chosen.story}>
              {busy && signature ? "Enregistrement…" : "Enregistrer le cadrage"}
            </Button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 14, marginTop: 12 }}>
        {step !== "posture" && (
          <button onClick={back} disabled={busy} style={{ fontSize: 13, background: "none", border: "none", color: color.text3, cursor: "pointer", padding: 0 }}>
            ← Retour
          </button>
        )}
        <button onClick={() => setOpen(false)} disabled={busy} style={{ fontSize: 13, background: "none", border: "none", color: color.textMuted, cursor: "pointer", padding: 0 }}>
          Annuler
        </button>
      </div>
      {error && <p style={{ fontSize: 13, color: color.danger, margin: "10px 0 0" }}>{error}</p>}
    </div>
  );
}
