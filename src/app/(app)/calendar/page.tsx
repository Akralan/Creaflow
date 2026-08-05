"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PlatformBadge } from "@/components/ui/Badge";
import { TextField, heading1Style } from "@/components/ui/TextField";
import IconActionButton from "@/components/ui/IconActionButton";
import EntryCard from "@/components/EntryCard";
import GenerateScriptModal from "@/components/GenerateScriptModal";
import { api, ApiClientError, type CalendarEntry, type ContentType, type PostingGoal, type Script } from "@/lib/apiClient";
import { accent, color, platformMeta, statusMeta } from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useContentCategories } from "@/contexts/CategoryLabelsContext";
import { useContentSeries } from "@/contexts/SeriesContext";
import { KNOWN_PLATFORMS } from "@/lib/social/types";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const CONTENT_TYPE_SHORT: Record<ContentType, string> = { video: "Vidéo", visual: "Visuel", text: "Texte" };

function monthKey(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, monthIndex: number) {
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(
    new Date(year, monthIndex, 1)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function startOfWeek(d: Date) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // lundi = 0
  date.setDate(date.getDate() - day);
  return date;
}

function dayDateStr(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const router = useRouter();
  const categories = useContentCategories();
  const series = useContentSeries();
  const today = useMemo(() => new Date(), []);
  const [year, setYear] = useState(today.getFullYear());
  const [monthIndex, setMonthIndex] = useState(today.getMonth());

  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [goals, setGoals] = useState<PostingGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingSlotId, setGeneratingSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const [goalDrafts, setGoalDrafts] = useState<Record<string, number>>(
    Object.fromEntries(KNOWN_PLATFORMS.map((p) => [p.key, 0]))
  );
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null);
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editSeriesId, setEditSeriesId] = useState<string>("");
  const [savingEntry, setSavingEntry] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [modalScheduledDate, setModalScheduledDate] = useState<string | undefined>(undefined);
  const [placingScript, setPlacingScript] = useState<Script | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!placingScript) return;
    function handleMouseMove(e: MouseEvent) {
      setCursorPos({ x: e.clientX, y: e.clientY });
    }
    function handleWindowClick() {
      // Un onClick React (délégué à la racine) s'exécute avant un listener natif attaché
      // via addEventListener sur window (phase de bubbling, window est atteint en dernier).
      // Si une cellule/entrée a déjà consommé ce clic (placeAt a déjà appelé
      // setPlacingScript(null) de façon synchrone), l'updater fonctionnel voit déjà `null`
      // et ne fait rien. Sinon (clic hors cellule), on annule le placement.
      setPlacingScript((current) => (current === null ? current : null));
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPlacingScript(null);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleWindowClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [placingScript]);

  async function placeAt(dateStr: string) {
    const script = placingScript;
    if (!script) return;
    setPlacingScript(null);
    setCursorPos(null);
    setError(null);
    try {
      await api.placeScript(script.id, dateStr);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors du placement du script.");
    }
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { entries, goals } = await api.getCalendar(monthKey(year, monthIndex));
      setEntries(entries);
      setGoals(goals);
      setGoalDrafts(
        Object.fromEntries(
          KNOWN_PLATFORMS.map((p) => [p.key, goals.find((g) => g.platform === p.key)?.targetCountPerWeek ?? 0])
        )
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur de chargement du calendrier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, monthIndex]);

  function changeMonth(delta: number) {
    let m = monthIndex + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonthIndex(m);
    setYear(y);
  }

  async function handleGenerateMonth() {
    setGenerating(true);
    setError(null);
    try {
      await api.generateCalendar(monthKey(year, monthIndex));
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération du calendrier.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateSlot(entryId: string, contentType: ContentType) {
    setGeneratingSlotId(entryId);
    setError(null);
    try {
      const { script } = await api.generateScriptForEntry(entryId, contentType);
      router.push(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération du script.");
      setGeneratingSlotId(null);
    }
  }

  async function saveGoals() {
    setError(null);
    try {
      await Promise.all(KNOWN_PLATFORMS.map((p) => api.savePostingGoal(p.key, goalDrafts[p.key])));
      setEditingGoals(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement des objectifs.");
    }
  }

  function openEntryEditor(entry: CalendarEntry) {
    setEditingEntry(entry);
    setEditCategoryId(entry.contentCategory.id);
    setEditSeriesId(entry.series?.id ?? "");
  }

  async function saveEntryCategory() {
    if (!editingEntry) return;
    setSavingEntry(true);
    setError(null);
    try {
      await api.updateCalendarEntry(editingEntry.id, { contentCategoryId: editCategoryId, seriesId: editSeriesId || null });
      setEditingEntry(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la modification du créneau.");
    } finally {
      setSavingEntry(false);
    }
  }

  async function deleteEntry() {
    if (!editingEntry) return;
    setSavingEntry(true);
    setError(null);
    try {
      await api.deleteCalendarEntry(editingEntry.id);
      setEditingEntry(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la suppression du créneau.");
    } finally {
      setSavingEntry(false);
    }
  }

  const cells = useMemo(() => {
    const lead = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const byDay = new Map<number, CalendarEntry[]>();
    for (const e of entries) {
      const d = new Date(e.scheduledDate);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate();
        byDay.set(day, [...(byDay.get(day) || []), e]);
      }
    }
    const list: Array<{ day: number | null; entries: CalendarEntry[]; isToday: boolean }> = [];
    for (let i = 0; i < lead; i++) list.push({ day: null, entries: [], isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({
        day: d,
        entries: byDay.get(d) || [],
        isToday: d === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear(),
      });
    }
    while (list.length % 7 !== 0) list.push({ day: null, entries: [], isToday: false });
    return list;
  }, [entries, year, monthIndex, today]);

  const weekGoalProgress = useMemo(() => {
    const weekStart = startOfWeek(today);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const doneByPlatform: Record<string, number> = {};
    for (const e of entries) {
      const d = new Date(e.scheduledDate);
      if (d >= weekStart && d < weekEnd && e.status === "published") {
        doneByPlatform[e.platform] = (doneByPlatform[e.platform] || 0) + 1;
      }
    }
    return doneByPlatform;
  }, [entries, today]);

  const visibleGoals = useMemo(() => goals.filter((g) => g.targetCountPerWeek > 0), [goals]);

  if (loading) return null;

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, marginBottom: 26 }}>
        <div>
          <h1 style={heading1Style}>Votre mois de publication</h1>
          <p style={{ margin: "6px 0 0", color: color.textMuted, fontSize: 15 }}>
            Voici quoi tourner, et quand. Cliquez un créneau pour ouvrir le script.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: color.cardBg, border: `1px solid ${color.border}`, borderRadius: 12, padding: "6px 8px" }}>
          <button onClick={() => changeMonth(-1)} style={{ background: "none", border: "none", padding: "6px 8px", color: color.textFaint, fontSize: 16, cursor: "pointer" }}>‹</button>
          <span style={{ fontFamily: "var(--font-heading)", fontWeight: 600, fontSize: 16, minWidth: 140, textAlign: "center" }}>
            {monthLabel(year, monthIndex)}
          </span>
          <button onClick={() => changeMonth(1)} style={{ background: "none", border: "none", padding: "6px 8px", color: color.textMuted, fontSize: 16, cursor: "pointer" }}>›</button>
        </div>
      </div>

      {error && <p style={{ color: color.danger, fontSize: 14, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 288px", gap: 24, alignItems: "start" }}>
        <Card style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
            {WEEKDAYS.map((w) => (
              <div key={w} style={{ textAlign: "center", fontSize: 12, fontWeight: 600, color: color.textFaint, letterSpacing: "0.04em", textTransform: "uppercase", padding: "4px 0" }}>
                {w}
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {cells.map((c, i) => {
              const clickableEmpty = c.day !== null && c.entries.length === 0;
              return (
              <div
                key={i}
                onClick={() => {
                  if (placingScript) {
                    if (c.day !== null) placeAt(dayDateStr(year, monthIndex, c.day));
                    return;
                  }
                  if (clickableEmpty) {
                    setModalScheduledDate(dayDateStr(year, monthIndex, c.day as number));
                    setShowGenerateModal(true);
                  }
                }}
                title={clickableEmpty ? "Générer un script libre à cette date" : undefined}
                style={{
                  minHeight: 92,
                  borderRadius: 11,
                  border: `1px solid ${c.day ? "#eee7dd" : color.divider}`,
                  background: c.day ? color.cardBg : color.inputBg,
                  padding: 7,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  cursor: clickableEmpty || (placingScript && c.day !== null) ? "pointer" : "default",
                }}
              >
                {c.day && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.isToday ? "oklch(0.5 0.2 292)" : color.textSecondary }}>
                        {c.day}
                      </span>
                      {c.isToday && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: accent, borderRadius: 20, padding: "2px 6px" }}>
                          AUJ.
                        </span>
                      )}
                    </div>
                    {c.entries.map((entry) => {
                      const status = entry.script ? statusMeta[entry.script.status] : null;
                      const busy = generatingSlotId === entry.id;
                      return (
                        <EntryCard
                          key={entry.id}
                          data={{ platform: entry.platform, contentCategory: entry.contentCategory, series: entry.series, title: entry.script?.title }}
                          onClick={() => {
                            if (placingScript) return; // remonte à la cellule parente, qui gère la pose
                            if (entry.script) router.push(`/scripts/${entry.script.id}`);
                            else if (!busy) openEntryEditor(entry);
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          {entry.script ? (
                            status && (
                              <span style={{ marginTop: "auto", fontSize: 9, fontWeight: 700, color: status.fg, background: status.bg, borderRadius: 20, padding: "2px 7px", alignSelf: "flex-start" }}>
                                {status.label}
                              </span>
                            )
                          ) : busy ? (
                            <div style={{ marginTop: "auto", fontSize: 10, fontWeight: 600, color: "oklch(0.5 0.2 292)", border: "1px dashed oklch(0.6 0.15 292)", borderRadius: 6, padding: "3px 6px", textAlign: "center" }}>
                              ...
                            </div>
                          ) : (
                            <div style={{ marginTop: "auto", display: "flex", gap: 3 }}>
                              {(Object.keys(CONTENT_TYPE_SHORT) as ContentType[]).map((ct) => (
                                <button
                                  key={ct}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (placingScript) {
                                      if (c.day !== null) placeAt(dayDateStr(year, monthIndex, c.day));
                                      return;
                                    }
                                    handleGenerateSlot(entry.id, ct);
                                  }}
                                  title={`Générer un script ${CONTENT_TYPE_SHORT[ct].toLowerCase()}`}
                                  style={{
                                    flex: 1,
                                    fontSize: 9,
                                    fontWeight: 700,
                                    color: "oklch(0.5 0.2 292)",
                                    background: "none",
                                    border: "1px dashed oklch(0.6 0.15 292)",
                                    borderRadius: 6,
                                    padding: "3px 2px",
                                    cursor: "pointer",
                                  }}
                                >
                                  {CONTENT_TYPE_SHORT[ct]}
                                </button>
                              ))}
                            </div>
                          )}
                        </EntryCard>
                      );
                    })}
                  </>
                )}
              </div>
              );
            })}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 0 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 17 }}>Objectifs de la semaine</div>
              {!editingGoals && (
                <button onClick={() => setEditingGoals(true)} style={{ background: "none", border: "none", color: "oklch(0.5 0.2 292)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Modifier
                </button>
              )}
            </div>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>Votre rythme par plateforme.</p>

            {editingGoals ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {KNOWN_PLATFORMS.map(({ key: p, label }) => (
                  <TextField
                    key={p}
                    label={label}
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    helper="0.5 = 1 publication toutes les 2 semaines"
                    value={goalDrafts[p]}
                    onChange={(e) => setGoalDrafts((d) => ({ ...d, [p]: Number(e.target.value) }))}
                  />
                ))}
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="secondary" onClick={() => setEditingGoals(false)} style={{ flex: 1, padding: "10px" }}>
                    Annuler
                  </Button>
                  <Button onClick={saveGoals} style={{ flex: 1, padding: "10px" }}>
                    Enregistrer
                  </Button>
                </div>
              </div>
            ) : visibleGoals.length === 0 ? (
              <p style={{ fontSize: 13, color: color.textMuted }}>
                Aucun objectif défini.{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setEditingGoals(true); }}>
                  En définir un
                </a>
                .
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {visibleGoals.map((g) => {
                  const done = weekGoalProgress[g.platform] || 0;
                  const pct = g.targetCountPerWeek > 0 ? Math.min(100, Math.round((done / g.targetCountPerWeek) * 100)) : 0;
                  return (
                    <div key={g.id}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <PlatformBadge platform={g.platform} />
                          <span style={{ fontSize: 14, fontWeight: 600 }}>{platformMeta[g.platform].label}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: color.textSecondary }}>
                          {done}/{g.targetCountPerWeek}
                        </span>
                      </div>
                      <div style={{ height: 7, borderRadius: 20, background: color.trackBg, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, borderRadius: 20, background: platformMeta[g.platform].badgeBg }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${color.dividerAlt}`, fontSize: 13, color: color.textMuted, display: "flex", alignItems: "center", gap: 8 }}>
              {entries.length > 0 ? (
                <>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color.successDot }} />
                  Calendrier généré pour {monthLabel(year, monthIndex)}
                </>
              ) : goals.length > 0 ? (
                <Button onClick={handleGenerateMonth} disabled={generating} fullWidth>
                  {generating ? "Génération..." : "Générer le calendrier du mois"}
                </Button>
              ) : (
                "Définissez vos objectifs pour générer le mois."
              )}
            </div>
          </Card>

          <button
            onClick={() => {
              setModalScheduledDate(undefined);
              setShowGenerateModal(true);
            }}
            style={{
              background: color.cardBg,
              border: `1px solid ${color.border}`,
              borderRadius: 16,
              padding: "16px 18px",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ width: 38, height: 38, borderRadius: 11, background: "oklch(0.55 0.2 292 / 0.1)", color: "oklch(0.5 0.2 292)", display: "grid", placeItems: "center", fontSize: 18, flexShrink: 0 }}>
              ✎
            </span>
            <span>
              <span style={{ display: "block", fontWeight: 600, fontSize: 14, color: color.text }}>Générer un script libre</span>
              <span style={{ display: "block", fontSize: 12, color: color.textMuted }}>Hors calendrier, à la demande</span>
            </span>
          </button>
        </div>
      </div>

      <GenerateScriptModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        scheduledDate={modalScheduledDate}
        onGenerated={(script) => {
          setShowGenerateModal(false);
          if (modalScheduledDate) {
            load();
          } else {
            setPlacingScript(script);
          }
        }}
      />

      {placingScript && cursorPos && (
        <div style={{ position: "fixed", left: cursorPos.x + 18, top: cursorPos.y + 18, width: 176, pointerEvents: "none", zIndex: 60 }}>
          <EntryCard
            data={{ platform: placingScript.platform, contentCategory: placingScript.contentCategory, series: placingScript.series, title: placingScript.title }}
            style={{ boxShadow: "0 10px 26px rgba(28,25,23,0.22)" }}
          />
        </div>
      )}

      {editingEntry && (
        <div
          onClick={() => !savingEntry && setEditingEntry(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(28,25,23,0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
          }}
        >
          <Card
            onClick={(e) => e.stopPropagation()}
            style={{ padding: 26, width: 380, maxWidth: "90vw" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <PlatformBadge platform={editingEntry.platform} />
              <span style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 17 }}>
                Créneau du {new Date(editingEntry.scheduledDate).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </span>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: color.textMuted }}>
              Ce créneau n&apos;a pas encore de script généré.
            </p>

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>
              Catégorie de contenu
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {categories.map((c) => {
                const meta = resolveCategoryMeta(c);
                const active = c.id === editCategoryId;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setEditCategoryId(c.id);
                      setEditSeriesId((current) => {
                        const stillValid = series.some((s) => s.id === current && s.categories.some((cat) => cat.id === c.id));
                        return stillValid ? current : "";
                      });
                    }}
                    style={{
                      border: `1.5px solid ${active ? meta.base : color.border}`,
                      background: active ? meta.bg : color.inputBg,
                      borderRadius: 20,
                      padding: "7px 13px",
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      color: active ? meta.fg : color.textMuted,
                      cursor: "pointer",
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>

            {(() => {
              const availableEditSeries = series.filter((s) => s.categories.some((c) => c.id === editCategoryId));
              if (availableEditSeries.length === 0) return null;
              const effectiveEditSeriesId = availableEditSeries.some((s) => s.id === editSeriesId) ? editSeriesId : "";
              return (
                <>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: color.textSecondary, marginBottom: 8 }}>
                    Série <span style={{ color: color.textFaint, fontWeight: 400 }}>— optionnel</span>
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
                    <button
                      onClick={() => setEditSeriesId("")}
                      style={{
                        border: `1.5px solid ${effectiveEditSeriesId === "" ? accent : color.border}`,
                        background: effectiveEditSeriesId === "" ? "oklch(0.55 0.2 292 / 0.08)" : color.inputBg,
                        borderRadius: 20,
                        padding: "7px 13px",
                        fontSize: 13,
                        fontWeight: effectiveEditSeriesId === "" ? 600 : 500,
                        color: effectiveEditSeriesId === "" ? "oklch(0.45 0.2 292)" : color.textMuted,
                        cursor: "pointer",
                      }}
                    >
                      Aucune série
                    </button>
                    {availableEditSeries.map((s) => {
                      const active = s.id === effectiveEditSeriesId;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setEditSeriesId(s.id)}
                          style={{
                            border: `1.5px solid ${active ? accent : color.border}`,
                            background: active ? "oklch(0.55 0.2 292 / 0.08)" : color.inputBg,
                            borderRadius: 20,
                            padding: "7px 13px",
                            fontSize: 13,
                            fontWeight: active ? 600 : 500,
                            color: active ? "oklch(0.45 0.2 292)" : color.textMuted,
                            cursor: "pointer",
                          }}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}

            {error && <p style={{ color: color.danger, fontSize: 13, marginBottom: 14 }}>{error}</p>}

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <IconActionButton
                icon={Trash2}
                variant="danger"
                title="Supprimer le créneau"
                onClick={deleteEntry}
                disabled={savingEntry}
              />
              <div style={{ flex: 1 }} />
              <IconActionButton
                icon={X}
                variant="neutral"
                title="Annuler"
                onClick={() => setEditingEntry(null)}
                disabled={savingEntry}
              />
              <IconActionButton
                icon={Check}
                variant="primary"
                title="Enregistrer"
                onClick={saveEntryCategory}
                disabled={
                  savingEntry ||
                  (editCategoryId === editingEntry.contentCategory.id && editSeriesId === (editingEntry.series?.id ?? ""))
                }
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
