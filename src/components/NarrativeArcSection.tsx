"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { api, ApiClientError, type ContentSeries, type NarrativeBeat, type Product } from "@/lib/apiClient";
import { color } from "@/lib/design/tokens";

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

function beatsEqual(a: NarrativeBeat[], b: NarrativeBeat[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Référence stable (pas un `[]` littéral recréé à chaque rendu) — sinon la comparaison par
// référence plus bas ne stabilise jamais quand narrativeState est null, et boucle.
const EMPTY_BEATS: NarrativeBeat[] = [];

/**
 * Arc narratif d'une série (docs/SPEC_REDACTEUR_EN_CHEF.md §7) — mode, plan (arcSummary + beats),
 * callbacks, promesses ouvertes, boutons Planifier/Replanifier. Décision d'implémentation Lot B2 :
 * `formatContract` (mode rendez_vous) est différé au Lot B4 avec le reste des "spécificités
 * rendez_vous" (§8) — un état narratif ne peut d'ailleurs pas encore exister pour une série
 * rendez_vous, la planification étant bloquée dans ce mode (409).
 */
export default function NarrativeArcSection({
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

  useEffect(() => {
    api.getProducts().then(({ products }) => setProducts(products));
  }, []);

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

  const hasUnsavedBeats = !beatsEqual(beatsDraft, series.narrativeState?.beats ?? []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: color.textFaint }}>Mode :</span>
        <div style={{ display: "flex", background: color.chipBg, borderRadius: 8, padding: 2, gap: 2 }}>
          {(["feuilleton", "rendez_vous"] as const).map((m) => {
            const active = m === series.mode;
            return (
              <button
                key={m}
                onClick={() => switchMode(m)}
                disabled={switchingMode}
                style={{
                  fontSize: 12,
                  fontWeight: active ? 600 : 500,
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  cursor: switchingMode ? "default" : "pointer",
                  background: active ? color.cardBg : "transparent",
                  color: active ? color.text : color.textFaint,
                }}
              >
                {m === "feuilleton" ? "Feuilleton" : "Rendez-vous"}
              </button>
            );
          })}
        </div>
        {series.narrativeState?.isStale && (
          <span style={badgeStyle("oklch(0.55 0.18 60)", "oklch(0.62 0.13 60 / 0.16)")}>Nouvelle matière non planifiée</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: color.textFaint }}>Sujet :</span>
        <select
          value={series.product?.id ?? ""}
          onChange={(e) => switchProduct(e.target.value)}
          disabled={switchingProduct}
          title="Le sujet dont cette série tire sa matière — sans sujet, le rédacteur en chef lit la matière de niveau marque"
          style={{
            fontSize: 12,
            border: `1px solid ${color.inputBorder}`,
            borderRadius: 6,
            padding: "4px 8px",
            fontFamily: "inherit",
            background: color.inputBg,
            color: color.text,
          }}
        >
          <option value="">Aucun sujet — matière de niveau marque</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: color.danger }}>{error}</p>}

      {series.mode === "rendez_vous" ? (
        <p style={{ margin: 0, fontSize: 12, color: color.textFaint }}>
          Épisodes autonomes, sans plan à maintenir — pas de planification dans ce mode.
        </p>
      ) : !series.narrativeState ? (
        <Button variant="secondary" onClick={plan} disabled={planning} style={{ padding: "8px 14px", fontSize: 13 }}>
          {planning ? "Planification..." : "Planifier la suite"}
        </Button>
      ) : (
        <div>
          {series.narrativeState.arcSummary && (
            <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.5, color: color.text2 }}>{series.narrativeState.arcSummary}</p>
          )}

          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {beatsDraft.map((beat, i) => {
              const kindMeta = KIND_META[beat.kind];
              const statusMetaEntry = STATUS_META[beat.status];
              const locked = beat.status === "published";
              return (
                <div
                  key={beat.id}
                  style={{ border: `1px solid ${color.border}`, borderRadius: 8, padding: 8, background: color.inputBg }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <span style={badgeStyle(kindMeta.fg, kindMeta.bg)}>{kindMeta.label}</span>
                    <span style={badgeStyle(statusMetaEntry.fg, statusMetaEntry.bg)}>{statusMetaEntry.label}</span>
                    {beat.scriptId && (
                      <button
                        onClick={() => router.push(`/scripts/${beat.scriptId}`)}
                        style={{ fontSize: 11, color: "oklch(0.5 0.2 292)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                      >
                        Voir le script →
                      </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {!locked && (
                      <>
                        <button
                          onClick={() => moveBeat(i, -1)}
                          disabled={i === 0}
                          title="Monter"
                          style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.3 : 1, padding: 2 }}
                        >
                          <ArrowUp size={13} color={color.textMuted} />
                        </button>
                        <button
                          onClick={() => moveBeat(i, 1)}
                          disabled={i === beatsDraft.length - 1}
                          title="Descendre"
                          style={{
                            border: "none",
                            background: "none",
                            cursor: i === beatsDraft.length - 1 ? "default" : "pointer",
                            opacity: i === beatsDraft.length - 1 ? 0.3 : 1,
                            padding: 2,
                          }}
                        >
                          <ArrowDown size={13} color={color.textMuted} />
                        </button>
                        {beat.status !== "skipped" && (
                          <button
                            onClick={() => skipBeat(beat.id)}
                            title="Passer ce beat"
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 2 }}
                          >
                            <X size={13} color={color.textFaint} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  {locked ? (
                    <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{beat.title}</div>
                  ) : (
                    <input
                      value={beat.title}
                      onChange={(e) => updateBeat(beat.id, { title: e.target.value })}
                      style={{
                        width: "100%",
                        border: "none",
                        background: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: color.text,
                        fontFamily: "inherit",
                        padding: 0,
                        marginBottom: 4,
                      }}
                    />
                  )}
                  {!locked && (
                    <input
                      value={beat.angleHint ?? ""}
                      onChange={(e) => updateBeat(beat.id, { angleHint: e.target.value || null })}
                      placeholder="Angle recommandé (optionnel)"
                      style={{
                        width: "100%",
                        border: "none",
                        background: "none",
                        fontSize: 12,
                        color: color.textMuted,
                        fontFamily: "inherit",
                        padding: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {series.narrativeState.callbacks.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 4 }}>Callbacks</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {series.narrativeState.callbacks.map((cb, i) => (
                  <span key={i} style={{ fontSize: 11, color: color.textMuted, background: color.chipBg, borderRadius: 10, padding: "2px 8px" }}>
                    {cb}
                  </span>
                ))}
              </div>
            </div>
          )}

          {series.narrativeState.openPromises.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: color.textFaint, marginBottom: 4 }}>Promesses ouvertes</div>
              <div style={{ display: "grid", gap: 4 }}>
                {series.narrativeState.openPromises.map((p) => (
                  <div key={p.text} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.text2 }}>
                    <span style={{ flex: 1 }}>{p.text}</span>
                    <button
                      onClick={() => closePromise(p.text)}
                      style={{ fontSize: 11, color: "oklch(0.5 0.2 292)", background: "none", border: "none", cursor: "pointer" }}
                    >
                      Fermer
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" onClick={plan} disabled={planning} style={{ padding: "7px 12px", fontSize: 12 }}>
              {planning ? "..." : "Replanifier"}
            </Button>
            {hasUnsavedBeats && (
              <>
                <Button onClick={saveBeats} disabled={savingBeats} style={{ padding: "7px 12px", fontSize: 12 }}>
                  {savingBeats ? "..." : "Enregistrer le plan"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setBeatsDraft(series.narrativeState?.beats ?? [])}
                  style={{ padding: "7px 12px", fontSize: 12 }}
                >
                  Annuler
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
