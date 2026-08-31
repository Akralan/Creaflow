"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, RefreshCw, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { PlatformBadge } from "@/components/ui/Badge";
import {
  api,
  ApiClientError,
  type ContentSeries,
  type NarrativeBeat,
  type Product,
  type Script,
  type SourceMaterial,
} from "@/lib/apiClient";
import { accentAlpha, color, fontHeading, fontMono, statusMeta } from "@/lib/design/tokens";

/**
 * Panneau de droite de l'écran Direction (maquette 1a) — remplace NarrativeArcSection, qui vivait
 * dans une carte dépliable. Même logique et mêmes appels d'API : mode, sujet lié, plan (arcSummary +
 * beats) en feuilleton, contrat de format en rendez-vous, callbacks et promesses dans les deux cas.
 * Ce qui change est la mise en page (timeline, encadré d'arc, cartes côte à côte) et l'ajout du bloc
 * « Scripts de cette série », qui sans cela n'aurait plus de point d'entrée depuis Direction.
 */

const KIND_META: Record<NarrativeBeat["kind"], { label: string; fg: string; bg: string }> = {
  material: { label: "Matière", fg: "oklch(0.45 0.14 250)", bg: "oklch(0.62 0.12 250 / 0.14)" },
  pedagogical: { label: "Pédagogique", fg: "oklch(0.5 0.16 150)", bg: "oklch(0.62 0.13 150 / 0.16)" },
  personal: { label: "Personnel", fg: "oklch(0.5 0.2 292)", bg: "oklch(0.55 0.2 292 / 0.12)" },
};

const STATUS_META: Record<NarrativeBeat["status"], { label: string; fg: string; bg: string }> = {
  planned: { label: "À venir", fg: color.textMuted, bg: color.trackBg },
  drafted: { label: "Brouillon", fg: "oklch(0.5 0.13 60)", bg: "oklch(0.62 0.13 60 / 0.16)" },
  published: { label: "Publié", fg: "oklch(0.42 0.14 150)", bg: "oklch(0.62 0.13 150 / 0.16)" },
  skipped: { label: "Passé", fg: color.textFaint, bg: color.chipBg },
};

const badgeStyle = (fg: string, bg: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  color: fg,
  background: bg,
  borderRadius: 20,
  padding: "2px 8px",
  flexShrink: 0,
});

const cardStyle: React.CSSProperties = {
  background: color.cardBg,
  border: `1px solid ${color.border}`,
  borderRadius: 14,
  padding: "18px 20px",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: color.textFaint,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

function beatsEqual(a: NarrativeBeat[], b: NarrativeBeat[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Référence stable (pas un `[]` littéral recréé à chaque rendu) — sinon la comparaison par
// référence plus bas ne stabilise jamais quand narrativeState est null, et boucle.
const EMPTY_BEATS: NarrativeBeat[] = [];

function relativeDate(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

/** Contrat de format (mode rendez_vous, §7) — même garde que MaterialSummaryField (MaterialPanel.tsx) :
 *  ne pas écraser une édition en cours si la valeur change ailleurs (ex. une autre session). */
function FormatContractField({
  formatContract,
  onSave,
}: {
  formatContract: string | null;
  onSave: (next: string | null) => Promise<void>;
}) {
  const [draft, setDraft] = useState(formatContract ?? "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (document.activeElement !== textareaRef.current) setDraft(formatContract ?? "");
  }, [formatContract]);

  return (
    <textarea
      ref={textareaRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      disabled={saving}
      onBlur={async () => {
        const trimmed = draft.trim();
        if (trimmed === (formatContract ?? "")) return;
        setSaving(true);
        try {
          await onSave(trimmed || null);
        } finally {
          setSaving(false);
        }
      }}
      placeholder="Ex : 3 news + 1 coup de cœur"
      rows={2}
      style={{
        width: "100%",
        border: `1px solid ${color.inputBorder}`,
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: "inherit",
        background: color.inputBg,
        color: color.text2,
        resize: "vertical",
      }}
    />
  );
}

export default function SeriesDetail({
  series,
  onSeriesUpdate,
}: {
  series: ContentSeries;
  onSeriesUpdate: (updated: ContentSeries) => void;
}) {
  const router = useRouter();
  const [switchingMode, setSwitchingMode] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serverBeats = series.narrativeState?.beats ?? EMPTY_BEATS;
  const [beatsDraft, setBeatsDraft] = useState<NarrativeBeat[]>(serverBeats);
  const [syncedServerBeats, setSyncedServerBeats] = useState<NarrativeBeat[]>(serverBeats);
  const [savingBeats, setSavingBeats] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [switchingProduct, setSwitchingProduct] = useState(false);
  const [newCallback, setNewCallback] = useState("");
  const [savingCallbacks, setSavingCallbacks] = useState(false);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

  // Scripts de la série (bloc « Scripts de cette série ») — sans cela, un script importé ou écrit à
  // la main, donc rattaché à aucun beat, n'est plus atteignable depuis Direction.
  useEffect(() => {
    let cancelled = false;
    api
      .getScripts({ seriesId: series.id })
      .then(({ scripts }) => !cancelled && setScripts(scripts))
      .catch(() => !cancelled && setScripts([]));
    return () => {
      cancelled = true;
    };
  }, [series.id]);

  // Titres des documents référencés par les beats (focusDocIds).
  useEffect(() => {
    let cancelled = false;
    api
      .getMaterials(series.product?.id)
      .then(({ materials }) => !cancelled && setMaterials(materials))
      .catch(() => !cancelled && setMaterials([]));
    return () => {
      cancelled = true;
    };
  }, [series.product?.id]);

  // Resynchronise le brouillon quand l'état serveur change (après Planifier/Replanifier, ou un
  // enregistrement réussi) — jamais pendant une sauvegarde en cours. Ajustement pendant le rendu
  // (pattern React "Adjusting state when a prop changes"), pas un useEffect : évite le rendu
  // supplémentaire d'un effet et le lint react-hooks/set-state-in-effect.
  if (!savingBeats && serverBeats !== syncedServerBeats) {
    setSyncedServerBeats(serverBeats);
    setBeatsDraft(serverBeats);
  }

  async function switchMode(mode: ContentSeries["mode"]) {
    if (mode === series.mode || switchingMode) return;
    setSwitchingMode(true);
    setError(null);
    try {
      await api.updateSeriesFields(series.id, { mode });
      onSeriesUpdate({ ...series, mode });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors du changement de mode.");
    } finally {
      setSwitchingMode(false);
    }
  }

  async function switchProduct(productId: string) {
    const nextId = productId || null;
    if (nextId === (series.product?.id ?? null)) return;
    setSwitchingProduct(true);
    setError(null);
    try {
      await api.updateSeriesFields(series.id, { productId: nextId });
      const product = nextId ? (products.find((p) => p.id === nextId) ?? null) : null;
      onSeriesUpdate({ ...series, product: product ? { id: product.id, name: product.name } : null });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors du changement de sujet.");
    } finally {
      setSwitchingProduct(false);
    }
  }

  async function plan() {
    setPlanning(true);
    setError(null);
    try {
      const { state } = await api.planNarrative({ seriesId: series.id });
      onSeriesUpdate({ ...series, narrativeState: state });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la planification.");
    } finally {
      setPlanning(false);
    }
  }

  /** Mode rendez_vous : /narrative/plan refuse ce mode (409) — pas de plan à maintenir — mais un
   *  état doit quand même exister pour porter formatContract/callbacks/promesses édités à la main
   *  (§5/§7, Lot B4). Créé paresseusement au premier besoin, sans jamais appeler le LLM. */
  async function ensureStateId(): Promise<string> {
    if (series.narrativeState) return series.narrativeState.id;
    const { state } = await api.ensureNarrativeState({ seriesId: series.id });
    onSeriesUpdate({ ...series, narrativeState: state });
    return state.id;
  }

  function moveBeat(index: number, direction: -1 | 1) {
    setBeatsDraft((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateBeat(id: string, patch: Partial<Pick<NarrativeBeat, "title" | "angleHint">>) {
    setBeatsDraft((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function skipBeat(id: string) {
    setBeatsDraft((prev) => prev.map((b) => (b.id === id ? { ...b, status: "skipped" } : b)));
  }

  async function saveBeats() {
    if (!series.narrativeState) return;
    setSavingBeats(true);
    setError(null);
    try {
      const { state } = await api.patchNarrativeState(series.narrativeState.id, { beats: beatsDraft });
      onSeriesUpdate({ ...series, narrativeState: state });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement du plan.");
    } finally {
      setSavingBeats(false);
    }
  }

  async function closePromise(text: string) {
    if (!series.narrativeState) return;
    setError(null);
    try {
      const { state } = await api.patchNarrativeState(series.narrativeState.id, { closePromiseText: text });
      onSeriesUpdate({ ...series, narrativeState: state });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la fermeture de la promesse.");
    }
  }

  async function saveCallbacks(next: string[]) {
    setSavingCallbacks(true);
    setError(null);
    try {
      const stateId = await ensureStateId();
      const { state } = await api.patchNarrativeState(stateId, { callbacks: next });
      onSeriesUpdate({ ...series, narrativeState: state });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'édition des callbacks.");
    } finally {
      setSavingCallbacks(false);
    }
  }

  function addCallback() {
    const text = newCallback.trim();
    if (!text) return;
    const current = series.narrativeState?.callbacks ?? [];
    setNewCallback("");
    if (current.includes(text)) return;
    saveCallbacks([...current, text]);
  }

  function removeCallback(text: string) {
    const current = series.narrativeState?.callbacks ?? [];
    saveCallbacks(current.filter((c) => c !== text));
  }

  async function saveFormatContract(next: string | null) {
    setError(null);
    try {
      const stateId = await ensureStateId();
      const { state } = await api.patchNarrativeState(stateId, { formatContract: next });
      onSeriesUpdate({ ...series, narrativeState: state });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement du contrat de format.");
    }
  }

  const state = series.narrativeState;
  const hasUnsavedBeats = !beatsEqual(beatsDraft, state?.beats ?? []);
  const docTitleById = new Map(materials.map((m) => [m.id, m.title]));
  // Premier beat encore à écrire : c'est lui que le rédacteur en chef prendra à la prochaine génération.
  const nextBeatId = beatsDraft.find((b) => b.status === "planned")?.id ?? null;

  function renderPromisesAndCallbacks() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 8 }}>
        <div style={cardStyle}>
          <div style={{ ...sectionLabelStyle, marginBottom: 12 }}>
            Promesses ouvertes {state && state.openPromises.length > 0 ? `· ${state.openPromises.length}` : ""}
          </div>
          {!state || state.openPromises.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: color.textFaint }}>Aucune promesse en attente.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {state.openPromises.map((p) => (
                <div key={p.text} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "oklch(0.55 0.18 60)",
                      flexShrink: 0,
                      marginTop: 6,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: color.text2, lineHeight: 1.45 }}>« {p.text} »</div>
                    {(() => {
                      // Rattache la promesse à l'épisode qui l'a faite quand le script est encore
                      // dans le plan ; sinon on se rabat sur la date, seule donnée toujours présente.
                      const originIndex = beatsDraft.findIndex((b) => b.scriptId && b.scriptId === p.scriptId);
                      const parts = [
                        originIndex >= 0 ? `Faite dans l'épisode ${originIndex + 1}` : null,
                        p.madeAt ? (originIndex >= 0 ? relativeDate(p.madeAt) : `Faite ${relativeDate(p.madeAt)}`) : null,
                      ].filter(Boolean);
                      if (parts.length === 0) return null;
                      return (
                        <div style={{ fontSize: 11, color: color.textFaint, marginTop: 2 }}>{parts.join(" · ")}</div>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => closePromise(p.text)}
                    style={{
                      fontFamily: "inherit",
                      fontSize: 12,
                      fontWeight: 600,
                      color: color.textMuted,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Fermer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={{ ...sectionLabelStyle, marginBottom: 12 }}>Callbacks — les détails familiers</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(state?.callbacks ?? []).length === 0 && (
              <p style={{ margin: 0, fontSize: 13, color: color.textFaint }}>Aucun callback pour l&apos;instant.</p>
            )}
            {(state?.callbacks ?? []).map((cb) => (
              <span
                key={cb}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: color.textSecondary,
                  background: color.chipBg,
                  borderRadius: 10,
                  padding: "4px 6px 4px 10px",
                }}
              >
                {cb}
                <button
                  onClick={() => removeCallback(cb)}
                  disabled={savingCallbacks}
                  title="Retirer ce callback"
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}
                >
                  <X size={11} color={color.textFaint} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={newCallback}
              onChange={(e) => setNewCallback(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCallback()}
              placeholder="Ajouter un callback..."
              disabled={savingCallbacks}
              style={{
                flex: 1,
                fontSize: 12,
                border: `1px solid ${color.inputBorder}`,
                borderRadius: 8,
                padding: "7px 10px",
                fontFamily: "inherit",
                background: color.inputBg,
                color: color.text,
              }}
            />
            <button
              onClick={addCallback}
              disabled={savingCallbacks || !newCallback.trim()}
              style={{
                fontFamily: "inherit",
                fontSize: 12,
                fontWeight: 600,
                color: "oklch(0.5 0.2 292)",
                background: accentAlpha(0.08),
                border: "none",
                borderRadius: 8,
                padding: "7px 12px",
                cursor: savingCallbacks || !newCallback.trim() ? "default" : "pointer",
                opacity: savingCallbacks || !newCallback.trim() ? 0.5 : 1,
              }}
            >
              Ajouter
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderSeriesScripts() {
    if (scripts.length === 0) return null;
    return (
      <div style={{ ...cardStyle, marginTop: 14 }}>
        <div style={{ ...sectionLabelStyle, marginBottom: 12 }}>Scripts de cette série · {scripts.length}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {scripts.map((script) => {
            const status = statusMeta[script.status];
            return (
              <div
                key={script.id}
                onClick={() => router.push(`/scripts/${script.id}`)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: color.inputBg,
                  cursor: "pointer",
                }}
              >
                <PlatformBadge platform={script.platform} size={18} />
                <span style={{ flex: 1, fontSize: 13, color: color.text2, minWidth: 0 }}>
                  {script.title ?? "(sans titre)"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: status.fg,
                    background: status.bg,
                    borderRadius: 20,
                    padding: "2px 8px",
                  }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, letterSpacing: "-0.02em", marginRight: 2 }}>
          {series.label}
        </div>

        <div style={{ display: "flex", background: color.chipBg, borderRadius: 8, padding: 2, gap: 2 }}>
          {(["feuilleton", "rendez_vous"] as const).map((m) => {
            const active = m === series.mode;
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                disabled={switchingMode}
                style={{
                  fontFamily: "inherit",
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: switchingMode ? "default" : "pointer",
                  background: active ? color.cardBg : "transparent",
                  color: active ? color.text : color.textFaint,
                  boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                }}
              >
                {m === "feuilleton" ? "Feuilleton" : "Rendez-vous"}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            color: color.textMuted,
            background: color.inputBg,
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 8,
            padding: "5px 10px",
          }}
        >
          Sujet :
          <select
            value={series.product?.id ?? ""}
            onChange={(e) => switchProduct(e.target.value)}
            disabled={switchingProduct}
            title="Le sujet dont cette série tire sa matière — sans sujet, le rédacteur en chef lit la matière de niveau marque"
            style={{
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              background: "none",
              fontFamily: "inherit",
              color: color.text,
              cursor: switchingProduct ? "default" : "pointer",
            }}
          >
            <option value="">Aucun sujet — matière de marque</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: 1 }} />

        {series.mode === "feuilleton" && (
          <Button onClick={plan} disabled={planning} style={{ padding: "10px 18px", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
            <RefreshCw size={14} strokeWidth={2} />
            {planning ? "Planification..." : state ? "Replanifier" : "Planifier la suite"}
          </Button>
        )}
      </div>

      {error && <p style={{ margin: "0 0 12px", fontSize: 13, color: color.danger }}>{error}</p>}

      {series.mode === "rendez_vous" ? (
        <>
          <div
            style={{
              background: accentAlpha(0.06),
              border: `1px solid ${accentAlpha(0.25)}`,
              borderRadius: 14,
              padding: "18px 20px",
              marginBottom: 14,
            }}
          >
            <div style={{ ...sectionLabelStyle, color: "oklch(0.47 0.2 292)", marginBottom: 8 }}>Contrat de format</div>
            <p style={{ margin: "0 0 10px", fontSize: 13, color: color.textMuted, lineHeight: 1.5 }}>
              Épisodes autonomes, sans plan à maintenir. Le contrat décrit la structure que chaque épisode doit respecter.
            </p>
            <FormatContractField formatContract={state?.formatContract ?? null} onSave={saveFormatContract} />
          </div>
          {renderPromisesAndCallbacks()}
          {renderSeriesScripts()}
        </>
      ) : !state ? (
        <>
          <div style={{ ...cardStyle, padding: "32px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: color.text2, marginBottom: 6, fontWeight: 600 }}>Pas encore de plan</div>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted, lineHeight: 1.55, maxWidth: 460, marginInline: "auto" }}>
              Le rédacteur en chef lit la matière du sujet lié et propose une suite d&apos;épisodes ordonnés. Tu pourras
              ensuite réordonner, réécrire ou passer chaque épisode.
            </p>
            <Button onClick={plan} disabled={planning}>
              {planning ? "Planification..." : "Planifier la suite"}
            </Button>
          </div>
          {renderPromisesAndCallbacks()}
          {renderSeriesScripts()}
        </>
      ) : (
        <>
          <div
            style={{
              background: accentAlpha(0.06),
              border: `1px solid ${accentAlpha(0.25)}`,
              borderRadius: 14,
              padding: "18px 20px",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <div style={{ ...sectionLabelStyle, color: "oklch(0.47 0.2 292)", letterSpacing: "0.06em" }}>
                Où en est l&apos;histoire
              </div>
              <div style={{ flex: 1 }} />
              {state.isStale && (
                <span style={badgeStyle("oklch(0.55 0.18 60)", "oklch(0.62 0.13 60 / 0.16)")}>
                  Nouvelle matière non planifiée
                </span>
              )}
              {state.lastPlannedAt && (
                <span style={{ fontSize: 12, color: color.textFaint }}>Planifié {relativeDate(state.lastPlannedAt)}</span>
              )}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.55, color: color.text2, maxWidth: 760 }}>
              {state.arcSummary ?? "L'arc n'a pas encore de résumé — replanifie pour que le rédacteur en chef le rédige."}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", columnGap: 14 }}>
            {beatsDraft.map((beat, i) => {
              const kindMeta = KIND_META[beat.kind];
              const statusMetaEntry = STATUS_META[beat.status];
              const locked = beat.status === "published";
              const isNext = beat.id === nextBeatId;
              const isLast = i === beatsDraft.length - 1;
              const docs = beat.focusDocIds.map((id) => docTitleById.get(id)).filter((t): t is string => !!t);

              return (
                <div key={beat.id} style={{ display: "contents" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        flexShrink: 0,
                        fontFamily: fontHeading,
                        fontWeight: 700,
                        fontSize: 13,
                        background:
                          beat.status === "published"
                            ? "oklch(0.62 0.13 150 / 0.16)"
                            : isNext
                              ? color.cardBg
                              : beat.status === "drafted"
                                ? "oklch(0.62 0.13 60 / 0.16)"
                                : color.trackBg,
                        border: isNext ? `2px solid oklch(0.6 0.15 292)` : "none",
                        color:
                          beat.status === "published"
                            ? "oklch(0.42 0.14 150)"
                            : isNext
                              ? "oklch(0.47 0.2 292)"
                              : beat.status === "drafted"
                                ? "oklch(0.5 0.13 60)"
                                : color.textMuted,
                      }}
                    >
                      {beat.status === "published" ? <Check size={14} strokeWidth={2.5} /> : i + 1}
                    </div>
                    {!isLast && <div style={{ flex: 1, width: 2, background: color.dividerAlt, minHeight: 12 }} />}
                  </div>

                  <div
                    style={{
                      background: color.cardBg,
                      border: `${isNext ? 1.5 : 1}px solid ${isNext ? "oklch(0.6 0.15 292)" : color.border}`,
                      boxShadow: isNext ? `0 0 0 3px ${accentAlpha(0.07)}` : "none",
                      borderRadius: 12,
                      padding: "13px 16px",
                      marginBottom: 10,
                      opacity: beat.status === "skipped" ? 0.6 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                      {locked ? (
                        <span style={{ fontSize: 14, fontWeight: 600, color: color.textMuted }}>{beat.title}</span>
                      ) : (
                        <input
                          value={beat.title}
                          onChange={(e) => updateBeat(beat.id, { title: e.target.value })}
                          placeholder="Titre de l'épisode"
                          style={{
                            flex: "1 1 240px",
                            minWidth: 0,
                            border: "none",
                            background: "none",
                            fontSize: 14,
                            fontWeight: 600,
                            color: color.text,
                            fontFamily: "inherit",
                            padding: 0,
                          }}
                        />
                      )}
                      <span style={badgeStyle(kindMeta.fg, kindMeta.bg)}>{kindMeta.label}</span>
                      <span style={badgeStyle(statusMetaEntry.fg, statusMetaEntry.bg)}>
                        {isNext && beat.status === "planned" ? "Prochain épisode" : statusMetaEntry.label}
                      </span>
                      {beat.scriptId && (
                        <button
                          onClick={() => router.push(`/scripts/${beat.scriptId}`)}
                          style={{
                            fontFamily: "inherit",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "oklch(0.5 0.2 292)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          Voir le script →
                        </button>
                      )}
                      <div style={{ flex: 1 }} />
                      {!locked && (
                        <span style={{ display: "flex", gap: 2, alignItems: "center", flexShrink: 0 }}>
                          <button
                            onClick={() => moveBeat(i, -1)}
                            disabled={i === 0}
                            title="Monter"
                            style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, padding: 2, display: "flex" }}
                          >
                            <ArrowUp size={14} color={color.textMuted} />
                          </button>
                          <button
                            onClick={() => moveBeat(i, 1)}
                            disabled={isLast}
                            title="Descendre"
                            style={{ border: "none", background: "none", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.3 : 1, padding: 2, display: "flex" }}
                          >
                            <ArrowDown size={14} color={color.textMuted} />
                          </button>
                          {beat.status !== "skipped" && (
                            <button
                              onClick={() => skipBeat(beat.id)}
                              title="Passer cet épisode"
                              style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}
                            >
                              <X size={14} color={color.textFaint} />
                            </button>
                          )}
                        </span>
                      )}
                    </div>

                    {!locked && (
                      <input
                        value={beat.angleHint ?? ""}
                        onChange={(e) => updateBeat(beat.id, { angleHint: e.target.value || null })}
                        placeholder="Angle recommandé (optionnel)"
                        style={{
                          width: "100%",
                          border: "none",
                          background: "none",
                          fontSize: 13,
                          color: color.textMuted,
                          fontFamily: "inherit",
                          padding: 0,
                          marginBottom: docs.length > 0 || beat.rationale ? 8 : 0,
                        }}
                      />
                    )}

                    {(docs.length > 0 || beat.rationale) && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        {docs.map((title) => (
                          <span
                            key={title}
                            style={{
                              fontSize: 11,
                              color: color.textSecondary,
                              background: color.chipBg,
                              borderRadius: 6,
                              padding: "2px 8px",
                              fontFamily: fontMono,
                            }}
                          >
                            {title}
                          </span>
                        ))}
                        {beat.rationale && (
                          <span style={{ fontSize: 11, color: color.textFaint }}>Pourquoi : {beat.rationale}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {renderPromisesAndCallbacks()}
          {renderSeriesScripts()}

          {hasUnsavedBeats && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 16,
                background: color.cardBg,
                border: `1px solid ${color.border}`,
                borderRadius: 12,
                padding: "10px 14px",
              }}
            >
              <span style={{ fontSize: 13, color: color.textMuted }}>Plan modifié — non enregistré</span>
              <div style={{ flex: 1 }} />
              <Button
                variant="ghost"
                onClick={() => setBeatsDraft(state.beats)}
                disabled={savingBeats}
                style={{ padding: "6px 8px", fontSize: 13 }}
              >
                Annuler
              </Button>
              <Button onClick={saveBeats} disabled={savingBeats} style={{ padding: "8px 16px", fontSize: 13 }}>
                {savingBeats ? "..." : "Enregistrer le plan"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
