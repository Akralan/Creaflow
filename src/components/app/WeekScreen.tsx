"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AppIcon from "@/components/app/AppIcon";
import { useAppChrome } from "@/components/app/AppChrome";
import PostPane from "@/components/app/PostPane";
import { api, ApiClientError, type WeekEntry } from "@/lib/apiClient";
import {
  addDays,
  dayKey,
  groupPosts,
  longDay,
  mondayOf,
  postState,
  shortDay,
  weekCounter,
  weekRange,
  type Network,
  type PostGroup,
  type PostState,
} from "@/lib/weekPosts";

/**
 * « Your content week » (docs/SPEC_APP_DESIGN_TELLOVO.md E8): the posts of the week as cards on the left, the open
 * post on the right. A post is one day of one series, written for LinkedIn and X.
 */

const POLL_MS = 4000;

const STATE_LABEL: Record<PostState, string> = { empty: "To write", writing: "Writing…", draft: "Draft", ready: "Ready", posted: "Posted" };
const STATE_CLASS: Record<PostState, string> = { empty: "status", writing: "status writing", draft: "status", ready: "status ready", posted: "status posted" };

function cardTitle(group: PostGroup<WeekEntry>): string {
  const first = group.versions.linkedin ?? group.versions.x;
  return group.versions.linkedin?.script?.title ?? group.versions.x?.script?.title ?? first?.upcoming?.title ?? "A post to write";
}

function cardSnippet(group: PostGroup<WeekEntry>, state: PostState): string {
  if (state === "writing") return "Writing this post for LinkedIn and X…";
  const text = group.versions.linkedin?.script?.caption ?? group.versions.x?.script?.caption;
  if (text) return text.replace(/\s+/g, " ").trim();
  return "Tellovo will write it for LinkedIn and X from what you shipped.";
}

export default function WeekScreen() {
  const chrome = useAppChrome();
  const params = useSearchParams();
  const [monday, setMonday] = useState<Date>(() => {
    const requested = params.get("week");
    return requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? mondayOf(new Date(`${requested}T00:00:00Z`)) : mondayOf(new Date());
  });
  const [entries, setEntries] = useState<WeekEntry[]>([]);
  const [hasLogo, setHasLogo] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network>("linkedin");
  // Read on the first render: the shell draws its children only once signed in, on the client.
  const [welcome, setWelcome] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem("cf.welcome") === "1";
    } catch {
      return false;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const jumped = useRef(false);
  const wantedPost = params.get("post");

  const mondayKey = dayKey(monday);
  // Looks at the week again (after a change, or while posts are being written).
  const load = useCallback(async () => {
    try {
      const { entries, hasLogo } = await api.getCalendarWeek(mondayKey, dayKey(addDays(new Date(`${mondayKey}T00:00:00Z`), 7)));
      setEntries(entries);
      setHasLogo(hasLogo);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "The week could not be loaded.");
    }
  }, [mondayKey]);

  // First reading of a week; it may jump to the first week that has posts (the first posts can start next week).
  useEffect(() => {
    let alive = true;
    api
      .getCalendarWeek(mondayKey, dayKey(addDays(new Date(`${mondayKey}T00:00:00Z`), 7)))
      .then(({ entries, hasLogo }) => {
        if (!alive) return;
        setEntries(entries);
        setHasLogo(hasLogo);
        if (!jumped.current) {
          jumped.current = true;
          const end = addDays(new Date(`${mondayKey}T00:00:00Z`), 7).getTime();
          const first = groupPosts(entries)[0];
          if (groupPosts(entries.filter((e) => new Date(e.scheduledDate).getTime() < end)).length === 0 && first) setMonday(mondayOf(new Date(`${first.date}T00:00:00Z`)));
        }
      })
      .catch((e) => alive && setError(e instanceof ApiClientError ? e.message : "The week could not be loaded."))
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [mondayKey]);

  const nextMonday = addDays(monday, 7);
  const weekEnd = nextMonday.getTime();
  const weekGroups = useMemo(() => groupPosts(entries.filter((e) => new Date(e.scheduledDate).getTime() < weekEnd)), [entries, weekEnd]);
  const nextGroups = useMemo(
    () => groupPosts(entries.filter((e) => new Date(e.scheduledDate).getTime() >= weekEnd && new Date(e.scheduledDate).getTime() < addDays(nextMonday, 7).getTime())),
    [entries, weekEnd, nextMonday]
  );
  const anyGenerating = entries.some((e) => e.status === "generating" && !e.script);

  // While posts are being written, the screen looks again every few seconds.
  useEffect(() => {
    if (!anyGenerating) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [anyGenerating, load]);

  const counter = useMemo(() => weekCounter(weekGroups), [weekGroups]);
  const { setWeekBadge } = chrome;
  useEffect(() => {
    setWeekBadge(weekGroups.length > 0 ? counter : null);
    return () => setWeekBadge(null);
  }, [counter, weekGroups.length, setWeekBadge]);

  // The open post: the one the visitor clicked, else the one asked for in the address, else the first.
  const group =
    weekGroups.find((g) => g.key === selected) ??
    (wantedPost ? weekGroups.find((g) => Object.values(g.versions).some((v) => v?.script?.id === wantedPost || v?.id === wantedPost)) : undefined) ??
    weekGroups[0] ??
    null;
  const seriesIds = new Set(weekGroups.map((g) => Object.values(g.versions)[0]?.series?.id));

  async function prepareNext() {
    setPreparing(true);
    setError(null);
    try {
      await api.prepareWeek(dayKey(nextMonday));
      chrome.refreshQuota();
      setMonday(nextMonday);
      jumped.current = true;
      await load();
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 402) chrome.openPaywall();
      else setError(e instanceof ApiClientError ? e.message : "The next week could not be prepared.");
    } finally {
      setPreparing(false);
    }
  }

  async function writeOne(entryId: string) {
    await api.writePost(entryId);
    chrome.refreshQuota();
    await load();
  }

  const posts = weekGroups.length;
  const subtitle = `${posts} ${posts === 1 ? "story" : "stories"} from what you shipped${chrome.audience ? `, written for ${chrome.audience.replace(/[.\s]+$/, "")}` : ""}.`;
  const nextPlanned = nextGroups.length;
  const nextWriting = nextGroups.some((g) => postState(g) === "writing");

  return (
    <>
      {welcome && (
        <div className="welcome" role="status">
          <span className="wi" aria-hidden="true">
            <AppIcon name="check" />
          </span>
          <p>
            <b>You&apos;re in.</b> Your workspace is ready — you signed in from your email link, no password needed.
          </p>
          <button
            className="xbtn"
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              setWelcome(false);
              try {
                sessionStorage.removeItem("cf.welcome");
              } catch {
                // Nothing to clean.
              }
            }}
          >
            <AppIcon name="x" />
          </button>
        </div>
      )}

      <header className="vh">
        <div>
          <p className="vk">
            Week of {weekRange(monday)}
            <span className="wk-nav">
              <button className="xbtn" type="button" aria-label="Previous week" onClick={() => { jumped.current = true; setMonday(addDays(monday, -7)); }}>
                <span aria-hidden="true">‹</span>
              </button>
              <button className="xbtn" type="button" aria-label="Next week" onClick={() => { jumped.current = true; setMonday(nextMonday); }}>
                <span aria-hidden="true">›</span>
              </button>
            </span>
          </p>
          <h1 className="vt">Your content week</h1>
          <p className="vs">{subtitle}</p>
        </div>
        <button className="btn btn-ink btn-lg" type="button" onClick={prepareNext} disabled={preparing}>
          {preparing ? "Preparing…" : "Prepare next week"} <span className="arr">→</span>
        </button>
      </header>
      {error && (
        <p className="err" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}

      {loaded && weekGroups.length === 0 ? (
        <div className="next" style={{ marginTop: 0 }}>
          <p className="row">
            <AppIcon name="calendar" small />
            {weekRange(monday)}
          </p>
          <b>Nothing is planned this week</b>
          <p>Give a series publishing days and its posts will land here.</p>
          <a className="link" href="/direction">
            Open Direction <span aria-hidden="true">→</span>
          </a>
        </div>
      ) : (
        <div className="wk-grid">
          <div className="list" role="group" aria-label="This week's posts">
            {weekGroups.map((g) => {
              const state = postState(g);
              const series = Object.values(g.versions)[0]?.series?.label;
              return (
                <button
                  key={g.key}
                  type="button"
                  className={`wday${g.key === group?.key ? " on" : ""}${state === "writing" ? " writing" : ""}`}
                  aria-pressed={g.key === group?.key}
                  onClick={() => setSelected(g.key)}
                >
                  <span className="day-short">{shortDay(g.date)}</span>
                  <span className="wday-top">
                    <span>{longDay(g.date)}</span>
                    <span className={STATE_CLASS[state]}>{STATE_LABEL[state]}</span>
                  </span>
                  <b>{cardTitle(g)}</b>
                  {seriesIds.size > 1 && series && <span className="series-tag">{series}</span>}
                  <span className="snip">{cardSnippet(g, state)}</span>
                </button>
              );
            })}
            <div className="next">
              <p className="row">
                <AppIcon name="lock" small />
                {weekRange(nextMonday)}
              </p>
              <b>Next week&apos;s stories</b>
              <p>
                {nextWriting
                  ? "Tellovo is writing them now."
                  : nextPlanned > 0
                    ? `${nextPlanned} ${nextPlanned === 1 ? "story is" : "stories are"} planned. Keep shipping — Tellovo reads what you build this week.`
                    : "Keep shipping — Tellovo will find the stories in what you build this week."}
              </p>
              <button className="link" type="button" onClick={prepareNext} disabled={preparing}>
                Prepare next week <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>

          {group && (
            <PostPane
              key={`${group.key}|${network}|${group.versions[network]?.script?.id ?? "none"}`}
              group={group}
              network={network}
              onNetwork={setNetwork}
              seriesLabel={Object.values(group.versions)[0]?.series?.label ?? null}
              authorName={chrome.authorName}
              productName={chrome.productName}
              hasLogo={hasLogo}
              onChanged={() => void load()}
              onQuota={chrome.openPaywall}
              onWrite={writeOne}
            />
          )}
        </div>
      )}
    </>
  );
}
