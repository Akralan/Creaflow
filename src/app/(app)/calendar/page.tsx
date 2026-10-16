"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Target, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import ImportScriptModal from "@/components/ImportScriptModal";
import ScriptFormatChooser from "@/components/ScriptFormatChooser";
import WeekPostCard, { WeekPostRow } from "@/components/calendar/WeekPostCard";
import SlotEditorModal from "@/components/calendar/SlotEditorModal";
import PlatformGoalsModal from "@/components/calendar/PlatformGoalsModal";
import styles from "@/components/calendar/calendar.module.css";
import { api, ApiClientError, type PostingGoal, type WeekEntry } from "@/lib/apiClient";
import { color, fontHeading, fontMono } from "@/lib/design/tokens";

/** Lundi (local) de la semaine qui contient `d`. */
function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** YYYY-MM-DD du jour local — les créneaux sont des jours (minuit UTC), pas des instants. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric" });
  const full = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" });
  return monday.getMonth() === sunday.getMonth()
    ? `Du ${day.format(monday)} au ${full.format(sunday)}`
    : `Du ${full.format(monday)} au ${full.format(sunday)}`;
}

/** Fin de la semaine dans la bande : une ligne pleine largeur, ce qui suit commence une rangée. */
function StripDivider() {
  return (
    <div aria-hidden style={{ flex: "0 0 100%", display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.08em", color: "#8a7f74" }}>ENSUITE</span>
      <span style={{ flex: 1, height: 1, background: "rgba(34,29,25,0.14)" }} />
    </div>
  );
}

const iconButton: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid rgba(34,29,25,0.1)",
  background: "#fffdfa",
  color: "#574d45",
  display: "grid",
  placeItems: "center",
  cursor: "pointer",
};

/**
 * Calendrier : une semaine, pas un mois — moins de pression, et chaque créneau montré comme le
 * post qu'il sera, côte à côte (une liste de titres sur téléphone). L'objectif de la semaine et
 * l'import d'un script sont derrière deux icônes.
 */
export default function CalendarPage() {
  const router = useRouter();
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const todayKey = useMemo(() => dayKey(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);

  const [entries, setEntries] = useState<WeekEntry[]>([]);
  const [goals, setGoals] = useState<PostingGoal[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [nextSlot, setNextSlot] = useState<WeekEntry | null>(null);
  const [monthToPlan, setMonthToPlan] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);

  const [choosingEntry, setChoosingEntry] = useState<WeekEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<WeekEntry | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getCalendarWeek(dayKey(monday), dayKey(addDays(monday, 7)));
      setEntries(data.entries);
      setGoals(data.goals);
      setAuthorName(data.authorName);
      setHasLogo(data.hasLogo);
      setNextSlot(data.nextSlot);
      setMonthToPlan(data.monthToPlan);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Chargement du calendrier impossible.");
    } finally {
      setLoaded(true);
    }
  }, [monday]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const activeGoals = goals.filter((g) => g.targetCountPerWeek > 0);
  const publishedThisWeek = useMemo(() => {
    const done: Record<string, number> = {};
    for (const e of entries) if (e.status === "published") done[e.platform] = (done[e.platform] ?? 0) + 1;
    return done;
  }, [entries]);

  /** Planifie des mois (un mois déjà planifié répond 409, sans conséquence ici) puis recharge. */
  async function planMonths(months: string[]) {
    setPlanning(true);
    setError(null);
    try {
      for (const month of months) {
        await api.generateCalendar(month).catch((err) => {
          // « Le calendrier de ce mois est déjà généré. » (409) : rien à faire pour ce mois.
          if (!(err instanceof ApiClientError && /déjà généré/.test(err.message))) throw err;
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "La planification a échoué.");
    } finally {
      setPlanning(false);
    }
  }

  /** Semaine vide : les mois qu'elle couvre. */
  const planWeek = () => planMonths([...new Set([dayKey(monday).slice(0, 7), dayKey(addDays(monday, 6)).slice(0, 7)])]);

  /** Plus aucun créneau vide à venir : le mois indiqué par le serveur, et le suivant s'il était déjà
   *  planifié. */
  function planMore() {
    if (!monthToPlan) return;
    const [y, m] = monthToPlan.split("-").map(Number);
    const following = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}`;
    planMonths([monthToPlan, following]);
  }

  function open(entry: WeekEntry) {
    if (entry.script) router.push(`/scripts/${entry.script.id}`);
    else setChoosingEntry(entry);
  }

  if (!loaded) return null;

  const isThisWeek = monday.getTime() === thisMonday.getTime();
  // Posts rédigés au-delà de la semaine, jusqu'au prochain à rédiger : séparés par « Ensuite ».
  const nextMondayKey = dayKey(addDays(monday, 7));
  const weekEntries = entries.filter((e) => e.scheduledDate.slice(0, 10) < nextMondayKey);
  // Après la semaine : les posts rédigés et le « post suivant », rangés ensemble par date.
  const laterEntries = [...entries.filter((e) => e.scheduledDate.slice(0, 10) >= nextMondayKey), ...(nextSlot ? [nextSlot] : [])].sort(
    (a, b) => a.scheduledDate.localeCompare(b.scheduledDate)
  );
  const kickerOf = (entry: WeekEntry) => (entry.id === nextSlot?.id ? "Post suivant" : undefined);
  const isPast = (entry: WeekEntry) => entry.scheduledDate.slice(0, 10) < todayKey;

  return (
    <div style={{ padding: "clamp(20px, 4vw, 36px) clamp(16px, 4vw, 40px)", minHeight: "100%", background: "#f7f4ef" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: "clamp(1.8rem, 3.4vw, 2.5rem)", letterSpacing: "-0.03em", margin: 0, color: "#1b1713" }}>
            {isThisWeek ? "Ta semaine" : "Semaine"}
          </h1>
          <p style={{ margin: "6px 0 0", color: "#6d6259", fontSize: 15 }}>{weekLabel(monday)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 2, background: "#fffdfa", border: "1px solid rgba(34,29,25,0.1)", borderRadius: 12, padding: 3 }}>
            <button type="button" aria-label="Semaine précédente" onClick={() => setMonday((m) => addDays(m, -7))} style={{ ...iconButton, border: "none", width: 34, height: 34 }}>
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMonday(thisMonday)}
              disabled={isThisWeek}
              style={{ border: "none", background: "none", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: isThisWeek ? "#a2988c" : "#574d45", padding: "0 8px", cursor: isThisWeek ? "default" : "pointer" }}
            >
              Aujourd&apos;hui
            </button>
            <button type="button" aria-label="Semaine suivante" onClick={() => setMonday((m) => addDays(m, 7))} style={{ ...iconButton, border: "none", width: 34, height: 34 }}>
              <ChevronRight size={18} />
            </button>
          </div>
          <button type="button" title="Objectif de la semaine" aria-label="Objectif de la semaine" onClick={() => setShowGoals(true)} style={iconButton}>
            <Target size={18} />
          </button>
          <button type="button" title="Importer un script existant" aria-label="Importer un script existant" onClick={() => setShowImport(true)} style={iconButton}>
            <Upload size={18} />
          </button>
        </div>
      </div>

      {error && <p style={{ color: color.danger, fontSize: 14, margin: "0 0 16px" }}>{error}</p>}

      {entries.length === 0 && !nextSlot ? (
        <div style={{ maxWidth: 520, padding: "36px 28px", borderRadius: 20, background: "#fffdfa", border: "1px solid rgba(34,29,25,0.08)" }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 21, color: "#1b1713", marginBottom: 6 }}>Rien de prévu cette semaine.</div>
          {activeGoals.length > 0 ? (
            <>
              <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6d6259" }}>On place tes posts sur tes jours de publication.</p>
              <Button onClick={planWeek} disabled={planning}>
                {planning ? "Planification…" : "Planifier mes posts"}
              </Button>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#6d6259" }}>
              Aucun réseau actif.{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setShowGoals(true); }}>
                En activer un
              </a>
              .
            </p>
          )}
        </div>
      ) : (
        <>
          <div className={styles.strip}>
            {weekEntries.map((entry) => (
              <WeekPostCard
                key={entry.id}
                entry={entry}
                authorName={authorName}
                hasLogo={hasLogo}
                isPast={isPast(entry)}
                onOpen={() => open(entry)}
                onEditSlot={() => setEditingEntry(entry)}
              />
            ))}
            {laterEntries.length > 0 && <StripDivider />}
            {laterEntries.map((entry) => (
              <WeekPostCard
                key={entry.id}
                kicker={kickerOf(entry)}
                entry={entry}
                authorName={authorName}
                hasLogo={hasLogo}
                isPast={false}
                onOpen={() => open(entry)}
                onEditSlot={() => setEditingEntry(entry)}
              />
            ))}
            {!nextSlot && monthToPlan && activeGoals.length > 0 && (
              <div className={styles.slot}>
                <div style={{ fontFamily: fontMono, fontSize: 11.5, letterSpacing: "0.06em", color: "#4d3778", fontWeight: 700 }}>
                  LA SUITE
                </div>
                <button type="button" className={`${styles.card} ${styles.holo}`} onClick={planMore} disabled={planning}>
                  <div style={{ position: "absolute", inset: 0, padding: 18, display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 1 }}>
                    <p style={{ margin: 0, fontFamily: fontHeading, fontWeight: 700, fontSize: 21, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#1b1713" }}>
                      {planning ? "On planifie…" : "Planifier la suite"}
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: 13, color: "#574d45" }}>Tes prochains posts, sur tes jours de publication.</p>
                  </div>
                </button>
              </div>
            )}
          </div>
          <div className={styles.list}>
            {weekEntries.map((entry) => (
              <WeekPostRow key={entry.id} entry={entry} isPast={isPast(entry)} onOpen={() => open(entry)} />
            ))}
            {laterEntries.length > 0 && (
              <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.08em", color: "#8a7f74", margin: "8px 2px 0" }}>ENSUITE</div>
            )}
            {laterEntries.map((entry) => (
              <WeekPostRow key={entry.id} kicker={kickerOf(entry)} entry={entry} isPast={false} onOpen={() => open(entry)} />
            ))}
            {!nextSlot && monthToPlan && activeGoals.length > 0 && (
              <Button variant="secondary" onClick={planMore} disabled={planning}>
                {planning ? "On planifie…" : "Planifier la suite"}
              </Button>
            )}
          </div>
        </>
      )}

      {/* Remonté à chaque créneau : le choix précédent ne doit pas rester coché. */}
      <ScriptFormatChooser key={choosingEntry?.id ?? "aucun"} entry={choosingEntry} onClose={() => setChoosingEntry(null)} />

      {editingEntry && (
        <SlotEditorModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={() => {
            setEditingEntry(null);
            load();
          }}
        />
      )}

      {showGoals && (
        <PlatformGoalsModal
          goals={goals}
          publishedThisWeek={publishedThisWeek}
          onClose={() => setShowGoals(false)}
          onSaved={() => {
            setShowGoals(false);
            load();
          }}
        />
      )}

      <ImportScriptModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          setShowImport(false);
          load();
        }}
      />
    </div>
  );
}
