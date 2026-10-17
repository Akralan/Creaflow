"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Target, Upload } from "lucide-react";
import ImportScriptModal from "@/components/ImportScriptModal";
import ScriptFormatChooser from "@/components/ScriptFormatChooser";
import WeekPostCard, { WeekPostRow } from "@/components/calendar/WeekPostCard";
import SlotEditorModal from "@/components/calendar/SlotEditorModal";
import PlatformGoalsModal from "@/components/calendar/PlatformGoalsModal";
import styles from "@/components/calendar/calendar.module.css";
import { api, ApiClientError, type ContentSeries, type PostingGoal, type WeekEntry } from "@/lib/apiClient";
import { rhythmLabel } from "@/lib/seriesRhythm";
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

/** Une ligne du calendrier : une série et ses posts, ou les posts hors série. */
interface Lane {
  key: string;
  series: ContentSeries | null;
  entries: WeekEntry[];
}

/**
 * Calendrier : une semaine, pas un mois — moins de pression, et chaque créneau montré comme le
 * post qu'il sera, côte à côte (une liste de titres sur téléphone). Avec plusieurs séries, une
 * ligne par série, pour voir où vit chacune (docs/SPEC_RYTHME_DES_SERIES.md §4). Les créneaux sont
 * posés par les rythmes des séries : il n'y a plus rien à « planifier » ici. L'objectif de la
 * semaine et l'import d'un script sont derrière deux icônes.
 */
export default function CalendarPage() {
  const router = useRouter();
  const thisMonday = useMemo(() => mondayOf(new Date()), []);
  const todayKey = useMemo(() => dayKey(new Date()), []);
  const [monday, setMonday] = useState(thisMonday);

  const [entries, setEntries] = useState<WeekEntry[]>([]);
  const [series, setSeries] = useState<ContentSeries[]>([]);
  const [goals, setGoals] = useState<PostingGoal[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [hasLogo, setHasLogo] = useState(false);
  const [nextSlot, setNextSlot] = useState<WeekEntry | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [choosingEntry, setChoosingEntry] = useState<WeekEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<WeekEntry | null>(null);
  const [showGoals, setShowGoals] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [data, { series: activeSeries }] = await Promise.all([
        api.getCalendarWeek(dayKey(monday), dayKey(addDays(monday, 7))),
        api.getContentSeries(),
      ]);
      setEntries(data.entries);
      setSeries(activeSeries);
      setGoals(data.goals);
      setAuthorName(data.authorName);
      setHasLogo(data.hasLogo);
      setNextSlot(data.nextSlot);
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

  function open(entry: WeekEntry) {
    if (entry.script) router.push(`/scripts/${entry.script.id}`);
    else setChoosingEntry(entry);
  }

  if (!loaded) return null;

  const isThisWeek = monday.getTime() === thisMonday.getTime();
  const nextMondayKey = dayKey(addDays(monday, 7));
  // La semaine, puis les posts rédigés des quatre semaines suivantes et le prochain post de chaque
  // série, rangés ensemble par date (le « post suivant » peut déjà figurer parmi eux).
  const all = [...entries, ...(nextSlot && !entries.some((e) => e.id === nextSlot.id) ? [nextSlot] : [])].sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate)
  );
  const isLater = (entry: WeekEntry) => entry.scheduledDate.slice(0, 10) >= nextMondayKey;
  const kickerOf = (entry: WeekEntry) => (entry.id === nextSlot?.id ? "Post suivant" : undefined);
  const isPast = (entry: WeekEntry) => entry.scheduledDate.slice(0, 10) < todayKey;

  // Une ligne par série dès qu'il y en a plusieurs, dans l'ordre de la Direction ; les posts hors
  // série (placés à la main, ou d'une série retirée) en dernière ligne, seulement s'il y en a.
  const activeIds = new Set(series.map((s) => s.id));
  const lanes: Lane[] =
    series.length > 1
      ? [
          ...series.map((s) => ({ key: s.id, series: s, entries: all.filter((e) => e.series?.id === s.id) })),
          { key: "hors-serie", series: null, entries: all.filter((e) => !e.series || !activeIds.has(e.series.id)) },
        ].filter((lane) => lane.series || lane.entries.length > 0)
      : [{ key: "tout", series: null, entries: all }];
  const withHeaders = lanes.length > 1 || series.length > 1;

  const renderCards = (laneEntries: WeekEntry[]) =>
    laneEntries.map((entry) => (
      <WeekPostCard
        key={entry.id}
        kicker={kickerOf(entry)}
        entry={entry}
        authorName={authorName}
        hasLogo={hasLogo}
        isPast={isPast(entry)}
        onOpen={() => open(entry)}
        onEditSlot={() => setEditingEntry(entry)}
      />
    ));

  const renderRows = (laneEntries: WeekEntry[]) => {
    const later = laneEntries.findIndex(isLater);
    return laneEntries.map((entry, i) => (
      <div key={entry.id} style={{ display: "contents" }}>
        {i === later && (
          <div style={{ fontFamily: fontMono, fontSize: 11, letterSpacing: "0.08em", color: "#8a7f74", margin: "8px 2px 0" }}>ENSUITE</div>
        )}
        <WeekPostRow kicker={kickerOf(entry)} entry={entry} isPast={isPast(entry)} onOpen={() => open(entry)} />
      </div>
    ));
  };

  const laneHeader = (lane: Lane) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", margin: "0 0 12px" }}>
      <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 18, color: "#1b1713", letterSpacing: "-0.01em" }}>
        {lane.series ? lane.series.label : "Hors série"}
      </span>
      {lane.series && (
        <>
          <span style={{ fontFamily: fontMono, fontSize: 11.5, letterSpacing: "0.04em", color: "#6d6259" }}>{rhythmLabel(lane.series.rhythm)}</span>
          <Link href={`/direction?series=${lane.series.id}&edit=1`} style={{ fontSize: 13, color: "#4d3778", fontWeight: 600 }}>
            Modifier le rythme
          </Link>
        </>
      )}
    </div>
  );

  const emptyLaneNote = (lane: Lane) =>
    lane.series && lane.entries.length === 0 ? (
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#6d6259" }}>
        {lane.series.rhythm ? "Rien de prévu sur les quatre prochaines semaines." : "Pas encore de jours de publication pour cette série."}
      </p>
    ) : null;

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

      {all.length === 0 && !withHeaders ? (
        <div style={{ maxWidth: 520, padding: "36px 28px", borderRadius: 20, background: "#fffdfa", border: "1px solid rgba(34,29,25,0.08)" }}>
          <div style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 21, color: "#1b1713", marginBottom: 6 }}>Rien de prévu cette semaine.</div>
          {activeGoals.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "#6d6259" }}>
              Aucun réseau actif.{" "}
              <a href="#" onClick={(e) => { e.preventDefault(); setShowGoals(true); }}>
                En activer un
              </a>
              .
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#6d6259" }}>
              Tes posts suivent le rythme de tes séries.{" "}
              <Link href="/direction">{series.length === 0 ? "Crée une série" : "Choisis leurs jours"}</Link> dans Direction.
            </p>
          )}
        </div>
      ) : (
        <>
          <div className={styles.lanes}>
            {lanes.map((lane) => (
              <section key={lane.key}>
                {withHeaders && laneHeader(lane)}
                {emptyLaneNote(lane)}
                {lane.entries.length > 0 && <div className={styles.strip}>{renderCards(lane.entries)}</div>}
              </section>
            ))}
          </div>
          <div className={styles.list}>
            {lanes.map((lane) => (
              <section key={lane.key} style={{ display: "contents" }}>
                {withHeaders && laneHeader(lane)}
                {emptyLaneNote(lane)}
                {renderRows(lane.entries)}
              </section>
            ))}
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
