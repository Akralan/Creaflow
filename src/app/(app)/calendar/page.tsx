"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PlatformBadge } from "@/components/ui/Badge";
import { TextField, heading1Style } from "@/components/ui/TextField";
import { api, ApiClientError, type CalendarEntry, type PostingGoal } from "@/lib/apiClient";
import {
  accent,
  color,
  platformMeta,
  platformOptions,
  statusMeta,
  type Platform,
} from "@/lib/design/tokens";
import { resolveCategoryMeta } from "@/lib/design/categoryDisplay";
import { useCategoryLabels } from "@/contexts/CategoryLabelsContext";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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

export default function CalendarPage() {
  const router = useRouter();
  const customLabels = useCategoryLabels();
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
  const [goalDrafts, setGoalDrafts] = useState<Record<Platform, number>>({ tiktok: 0, instagram: 0, linkedin: 0 });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { entries, goals } = await api.getCalendar(monthKey(year, monthIndex));
      setEntries(entries);
      setGoals(goals);
      setGoalDrafts({
        tiktok: goals.find((g) => g.platform === "tiktok")?.targetCountPerWeek ?? 0,
        instagram: goals.find((g) => g.platform === "instagram")?.targetCountPerWeek ?? 0,
        linkedin: goals.find((g) => g.platform === "linkedin")?.targetCountPerWeek ?? 0,
      });
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

  async function handleGenerateSlot(entryId: string) {
    setGeneratingSlotId(entryId);
    setError(null);
    try {
      const { script } = await api.generateScriptForEntry(entryId);
      router.push(`/scripts/${script.id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de la génération du script.");
      setGeneratingSlotId(null);
    }
  }

  async function saveGoals() {
    setError(null);
    try {
      await Promise.all(platformOptions.map((p) => api.savePostingGoal(p, goalDrafts[p])));
      setEditingGoals(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Erreur lors de l'enregistrement des objectifs.");
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
            {cells.map((c, i) => (
              <div
                key={i}
                style={{
                  minHeight: 92,
                  borderRadius: 11,
                  border: `1px solid ${c.day ? "#eee7dd" : color.divider}`,
                  background: c.day ? color.cardBg : color.inputBg,
                  padding: 7,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
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
                      const cat = resolveCategoryMeta(entry.contentCategory, customLabels);
                      const status = entry.script ? statusMeta[entry.script.status] : null;
                      const busy = generatingSlotId === entry.id;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => {
                            if (entry.script) router.push(`/scripts/${entry.script.id}`);
                            else if (!busy) handleGenerateSlot(entry.id);
                          }}
                          style={{
                            borderRadius: 8,
                            background: cat.bg,
                            border: `1px solid ${cat.border}`,
                            padding: 6,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <PlatformBadge platform={entry.platform} size={17} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: cat.fg, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                              {cat.label}
                            </span>
                          </div>
                          {entry.script ? (
                            <>
                              <div style={{ fontSize: 11, lineHeight: 1.2, color: "#2a2521", fontWeight: 500 }}>{entry.script.title}</div>
                              {status && (
                                <span style={{ marginTop: "auto", fontSize: 9, fontWeight: 700, color: status.fg, background: status.bg, borderRadius: 20, padding: "2px 7px", alignSelf: "flex-start" }}>
                                  {status.label}
                                </span>
                              )}
                            </>
                          ) : (
                            <div style={{ marginTop: "auto", fontSize: 10, fontWeight: 600, color: "oklch(0.5 0.2 292)", border: "1px dashed oklch(0.6 0.15 292)", borderRadius: 6, padding: "3px 6px", textAlign: "center" }}>
                              {busy ? "..." : "Générer le script"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
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
                {platformOptions.map((p) => (
                  <TextField
                    key={p}
                    label={platformMeta[p].label}
                    type="number"
                    min={0}
                    max={30}
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
            ) : goals.length === 0 ? (
              <p style={{ fontSize: 13, color: color.textMuted }}>
                Aucun objectif défini.{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setEditingGoals(true); }}>
                  En définir un
                </a>
                .
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {goals.map((g) => {
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
            onClick={() => router.push("/generate")}
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
    </div>
  );
}
