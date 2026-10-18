"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppIcon from "@/components/app/AppIcon";
import { useAppChrome } from "@/components/app/AppChrome";
import { api, ApiClientError, type WeekEntry } from "@/lib/apiClient";
import { addDays, dayKey, groupPosts, mondayOf, postState, shortDay, weekRange, type PostGroup } from "@/lib/weekPosts";

/** « Content plan » (docs/SPEC_APP_DESIGN_TELLOVO.md §2): the next four weeks, one row each. */

const WEEKS = 4;
const POLL_MS = 4000;

function weekTitle(index: number): string {
  return ["This week", "Next week", "In 2 weeks", "In 3 weeks"][index] ?? `In ${index} weeks`;
}

export default function PlanScreen() {
  const chrome = useAppChrome();
  const router = useRouter();
  const monday = useMemo(() => mondayOf(new Date()), []);
  const [entries, setEntries] = useState<WeekEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { entries } = await api.getCalendarWeek(dayKey(monday), dayKey(addDays(monday, 7)), { all: true });
      setEntries(entries);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "The plan could not be loaded.");
    } finally {
      setLoaded(true);
    }
  }, [monday]);

  useEffect(() => {
    let alive = true;
    api
      .getCalendarWeek(dayKey(monday), dayKey(addDays(monday, 7)), { all: true })
      .then(({ entries }) => alive && setEntries(entries))
      .catch((e) => alive && setError(e instanceof ApiClientError ? e.message : "The plan could not be loaded."))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [monday]);

  const anyGenerating = entries.some((e) => e.status === "generating" && !e.script);
  useEffect(() => {
    if (!anyGenerating) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [anyGenerating, load]);

  const weeks = useMemo(
    () =>
      Array.from({ length: WEEKS }, (_, i) => {
        const start = addDays(monday, i * 7);
        const end = addDays(start, 7);
        const groups = groupPosts(entries.filter((e) => new Date(e.scheduledDate) >= start && new Date(e.scheduledDate) < end));
        return { index: i, start, groups };
      }),
    [entries, monday]
  );

  async function prepare(start: Date) {
    setPreparing(true);
    setError(null);
    try {
      await api.prepareWeek(dayKey(start));
      chrome.refreshQuota();
      await load();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 402) chrome.openPaywall();
      else setError(e instanceof ApiClientError ? e.message : "The week could not be prepared.");
    } finally {
      setPreparing(false);
    }
  }

  function open(start: Date, group: PostGroup<WeekEntry>) {
    const entry = Object.values(group.versions)[0];
    router.push(`/calendar?week=${dayKey(start)}${entry ? `&post=${entry.id}` : ""}`);
  }

  // « Prepare next week » fills the nearest coming week that still has posts to write.
  const target = weeks.find((w, i) => i > 0 && w.groups.some((g) => postState(g) === "empty")) ?? weeks[1];
  const writingNow = weeks.reduce((n, w) => n + w.groups.filter((g) => postState(g) === "writing").length, 0);

  return (
    <>
      <header className="vh">
        <div>
          <p className="vk">Content plan</p>
          <h1 className="vt">Your next month, one week at a time.</h1>
          <p className="vs">Every week, Tellovo turns what you shipped into new stories. Plan ahead and never start from a blank page.</p>
        </div>
        <button className="btn btn-ink btn-lg" type="button" onClick={() => void prepare(target.start)} disabled={preparing}>
          {preparing ? "Preparing…" : "Prepare next week"} <span className="arr">→</span>
        </button>
      </header>
      {writingNow > 0 && (
        <p className="ai-note" role="status" style={{ marginBottom: 16 }}>
          <span className="status writing" />
          Tellovo is writing {writingNow} {writingNow === 1 ? "post" : "posts"}, for LinkedIn and X. They appear below as they are ready.
        </p>
      )}
      {error && (
        <p className="err" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      <div className="month">
        {weeks.map(({ index, start, groups }) => {
          const written = groups.filter((g) => postState(g) !== "empty" && postState(g) !== "writing").length;
          const ready = groups.filter((g) => ["ready", "posted"].includes(postState(g))).length;
          const locked = index > 0 && (groups.length === 0 || (written === 0 && !groups.some((g) => postState(g) === "writing")));
          const days = Array.from({ length: 7 }, (_, d) => dayKey(addDays(start, d)));
          return (
            <section key={dayKey(start)} className={`wrow${locked ? " locked" : ""}${locked && index > target.index ? " faded" : ""}`} aria-label={weekRange(start)}>
              <div className="wl">
                <b>{weekRange(start)}</b>
                <span className={index === 0 ? "now" : undefined}>{weekTitle(index)}</span>
                {index === 0 && groups.length > 0 && (
                  <span>
                    {ready} of {groups.length} ready
                  </span>
                )}
              </div>
              <div className="slots seven">
                {days.map((day) => {
                  const group = groups.find((g) => g.date === day);
                  if (!group || locked) {
                    return (
                      <div className="slot" key={day}>
                        <span className="d">{shortDay(day)}</span>
                      </div>
                    );
                  }
                  const state = postState(group);
                  const first = group.versions.linkedin ?? group.versions.x;
                  const title = group.versions.linkedin?.script?.title ?? group.versions.x?.script?.title ?? first?.upcoming?.title ?? "A post to write";
                  return (
                    <button className="pchip" type="button" key={day} onClick={() => open(start, group)}>
                      <span className="d">
                        {shortDay(day)}
                        <span className={state === "ready" ? "status ready" : state === "posted" ? "status posted" : state === "writing" ? "status writing" : "status"}>
                          {state === "empty" ? "To write" : state === "writing" ? "Writing…" : state === "draft" ? "Draft" : state === "ready" ? "Ready" : "Posted"}
                        </span>
                      </span>
                      <b>{title}</b>
                    </button>
                  );
                })}
                {index === target.index && locked && (
                  <div className="lock">
                    <div className="lock-in">
                      <p>
                        <AppIcon name="lock" small />
                        {groups.length > 0 ? `${groups.length} new ${groups.length === 1 ? "story" : "stories"} from what you ship this week` : "New stories from what you ship this week"}
                      </p>
                      <button className="btn btn-ink btn-sm" type="button" onClick={() => void prepare(start)} disabled={preparing}>
                        Prepare next week
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      {!loaded && <p className="k">Loading…</p>}
    </>
  );
}
