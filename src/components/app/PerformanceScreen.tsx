"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppIcon from "@/components/app/AppIcon";
import NetworkLogo from "@/components/app/NetworkLogo";
import PerformanceConnect from "@/components/app/PerformanceConnect";
import { api, ApiClientError, type PostMatchCandidate } from "@/lib/apiClient";
import type { PerformanceOverview } from "@/lib/performance/overview";
import {
  bestPostOf,
  daysUntilSettled,
  headlineOf,
  percentChange,
  reachRatio,
  type NetworkMetrics,
  type OverviewPost,
  type WeekTotals,
} from "@/lib/performance/derive";
import { NETWORKS, type Network, weekRange } from "@/lib/weekPosts";
import { platformLabel } from "@/lib/social/types";

/**
 * « Performance » (docs/SPEC_PERFORMANCE.md): the last four weeks of LinkedIn and X posts, one week in focus.
 * Three levels of weight — the week's impressions and their change, the best post, then the posts themselves.
 * The visual reference is docs/tests/performance-mockup/index.html.
 */

const MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const WEEKDAY = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  timeZone: "UTC",
});

/** 3900 → « 3.9k », 16210 → « 16.2k », 120 → « 120 ». */
function compact(n: number): string {
  if (n < 1000) return String(n);
  const thousands = Math.round(n / 100) / 10;
  if (thousands >= 1000) return `${(Math.round(n / 100000) / 10).toFixed(1).replace(/\.0$/, "")}M`;
  return `${thousands.toFixed(1).replace(/\.0$/, "")}k`;
}

function weekLabel(start: string): string {
  return weekRange(new Date(`${start}T00:00:00Z`));
}

function weekName(index: number, count: number): string {
  const ago = count - 1 - index;
  return ago === 0 ? "This week" : ago === 1 ? "Last week" : `${ago} weeks ago`;
}

function Delta({ value, className }: { value: number | null; className: string }) {
  if (value === null) return null;
  return (
    <span className={`${className}${value < 0 ? " dn" : ""}`}>
      {className === "pf-pill" ? (value < 0 ? "▼ " : "▲ ") : ""}
      {value >= 0 ? "+" : ""}
      {value}%
    </span>
  );
}

function titleFor(kind: ReturnType<typeof headlineOf>, week: WeekTotals, isCurrent: boolean, settling: boolean): string {
  if (week.posts === 0) return isCurrent ? "A fresh week." : "Nothing went out this week.";
  // While the views are still arriving, « growing » or « quieter » would only describe how young the week is.
  if (settling) return "Numbers are still coming in.";
  if (kind === "up") return "You're growing.";
  if (kind === "down") return "A quieter week.";
  if (kind === "flat") return "Holding steady.";
  return "Your first numbers.";
}

function NetworkCell({ network, metrics }: { network: Network; metrics: NetworkMetrics | null }) {
  if (!metrics) {
    return (
      <div className="net none">
        <b>—</b>
      </div>
    );
  }
  return (
    <div className="net">
      <b>
        <span className="mlogo">
          <NetworkLogo network={network} />
        </span>
        {compact(metrics.impressions)}
      </b>
      <small>
        <span className="pf-em" title="Likes">
          <AppIcon name="heart" small />
          <span className="sr">Likes </span>
          {metrics.likes}
        </span>
        <span className="pf-em" title="Comments">
          <AppIcon name="comment" small />
          <span className="sr">Comments </span>
          {metrics.comments}
        </span>
        <span className="pf-em" title="Shares">
          <AppIcon name="repeat" small />
          <span className="sr">Shares </span>
          {metrics.shares}
        </span>
      </small>
    </div>
  );
}

function PostRow({ post, isBest, faded }: { post: OverviewPost; isBest: boolean; faded: boolean }) {
  const date = new Date(post.publishedAt);
  return (
    <div className={`pf-tr${faded ? " pf-faded" : ""}`}>
      <span className="pf-date">
        <b>{date.getUTCDate()}</b>
        <span>{WEEKDAY.format(date)}</span>
      </span>
      <span className="ti">
        {post.title}
        {isBest && <em>Best post</em>}
      </span>
      <NetworkCell network="linkedin" metrics={post.linkedin} />
      <NetworkCell network="x" metrics={post.x} />
    </div>
  );
}

export default function PerformanceScreen() {
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [index, setIndex] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<Network[]>([]);
  const [candidates, setCandidates] = useState<PostMatchCandidate[]>([]);
  const listRef = useRef<HTMLElement | null>(null);
  const alive = useRef(true);
  // Read once: how old a post is decides how many days its numbers still have to settle.
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    const next = await api.getPerformanceOverview();
    setOverview(next);
    // Posts the network shows that might be one of ours, waiting for a yes or a no.
    setCandidates(next.pendingCandidates > 0 ? (await api.getMatchCandidates()).candidates : []);
    // First load: land on the latest week that has posts (on a Monday morning the current one is still empty).
    // Later loads (after a refresh) keep the week the user is on.
    let latest = next.weeks.length - 1;
    while (latest > 0 && next.weeks[latest].posts === 0) latest--;
    // Nothing anywhere: stay on the current week rather than the oldest.
    if (next.weeks[latest].posts === 0) latest = next.weeks.length - 1;
    setIndex((current) => current ?? latest);
  }, []);

  // Reads the numbers from the networks, then shows what came back. Also what « connect » runs once a network is set.
  const refresh = useCallback(async () => {
    setSyncing(true);
    setRefreshError(null);
    try {
      const { results } = await api.refreshPerformance();
      if (!alive.current) return;
      // A network that answers with an error that is not a lapsed connection (that one has its own banner)
      // is shown as « stats not available », never as zeros.
      setUnavailable(
        results.filter((r) => r.error && (NETWORKS as readonly string[]).includes(r.platform)).map((r) => r.platform as Network)
      );
      await load();
    } catch (e) {
      if (alive.current) {
        setRefreshError(
          e instanceof ApiClientError && e.status === 429
            ? "Too many refreshes in a row — try again in a minute."
            : "The numbers could not be refreshed just now; what you see may be a little old."
        );
      }
    } finally {
      if (alive.current) setSyncing(false);
    }
  }, [load]);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (alive.current) setError(e instanceof ApiClientError ? e.message : "The numbers could not be loaded.");
        return;
      }
      if (alive.current) await refresh();
    })();
    return () => {
      alive.current = false;
    };
  }, [load, refresh]);

  const weeks = useMemo(() => overview?.weeks ?? [], [overview]);
  const posts = useMemo(() => overview?.posts ?? [], [overview]);
  const selected = index === null ? null : (weeks[index] ?? null);

  // Scrolling down the list moves the week in focus, so the numbers above always describe what is on screen.
  useEffect(() => {
    const root = listRef.current;
    if (!root || weeks.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const next = Number((entry.target as HTMLElement).dataset.w);
          if (!Number.isNaN(next)) setIndex(next);
        }
      },
      { rootMargin: "-12% 0px -80% 0px" }
    );
    root.querySelectorAll<HTMLElement>(".pf-wk").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [weeks.length, posts.length]);

  async function resolveCandidate(id: string, action: "confirm" | "dismiss") {
    setError(null);
    try {
      await api.resolveMatchCandidate(id, action);
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Something went wrong, please try again.");
    }
  }

  const median = overview?.medianImpressions ?? null;
  const best = useMemo(() => (selected ? bestPostOf(posts, selected.start) : null), [posts, selected]);

  if (!overview || !selected || index === null) {
    return (
      <>
        <header className="vh">
          <div>
            <p className="vk">Performance</p>
            <h1 className="vt">How your posts are doing.</h1>
            {error && (
              <p className="err" role="alert" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}
          </div>
        </header>
      </>
    );
  }

  const previous = index > 0 ? weeks[index - 1] : null;
  // A week with no post that has numbers yet counts for nothing: no « −100 % » on the Monday after a good week.
  const weekEmpty = selected.posts === 0;
  const change = (value: number, before: number | undefined) => (previous && !weekEmpty ? percentChange(value, before) : null);
  const mood = headlineOf(weeks, index);
  // A network counts as connected once we can read it: linked, or (X) given by its handle.
  const connected = NETWORKS.filter((n) => overview.connections[n] === "ok" || overview.connections[n] === "needs_reconnect");
  const lapsed = NETWORKS.filter((n) => overview.connections[n] === "needs_reconnect");
  const anyPost = posts.length > 0;
  // Nothing connected and nothing to show: the page is the choice of a first network. Once one is connected the
  // page keeps its real shape, with dashes where the numbers will be.
  const noNetwork = connected.length === 0 && !anyPost;
  const empty = !anyPost;
  const fig = (n: number) => (empty || weekEmpty ? "—" : compact(n));
  const settle = weekEmpty ? 0 : daysUntilSettled(posts, selected.start, now);
  const name = weekName(index, weeks.length);

  let subtitle = "";
  if (selected.posts > 0) {
    subtitle = `${name}, ${selected.posts} ${selected.posts === 1 ? "post" : "posts"} earned ${compact(selected.impressions)} impressions on LinkedIn and X`;
    const d = change(selected.impressions, previous?.impressions);
    if (settle > 0) subtitle += " so far — views keep arriving for a few days.";
    else if (d === null) subtitle += ".";
    else if (d === 0) subtitle += ", the same as the week before.";
    else subtitle += d > 0 ? `, ${d}% more than the week before.` : `, ${-d}% fewer than the week before.`;
  } else if (anyPost) {
    subtitle = `${name}: nothing to count yet — numbers show up a few days after a post goes out.`;
  } else if (empty && connected.length > 0) {
    subtitle = syncing
      ? "Looking for your posts…"
      : "No post spotted yet — a post shows up here within a day of going out, on " + connected.map(platformLabel).join(" and ") + ".";
  }

  function go(next: number) {
    setIndex(Math.min(weeks.length - 1, Math.max(0, next)));
  }

  return (
    <>
      <header className="vh">
        <div>
          <p className="vk">
            Performance
            <span className="wk-nav">
              <button className="xbtn" type="button" aria-label="Previous week" disabled={index === 0} onClick={() => go(index - 1)}>
                <span aria-hidden="true">‹</span>
              </button>
              <button
                className="xbtn"
                type="button"
                aria-label="Next week"
                disabled={index === weeks.length - 1}
                onClick={() => go(index + 1)}
              >
                <span aria-hidden="true">›</span>
              </button>
            </span>
            {syncing && <span className="pf-sync">Updating…</span>}
          </p>
          <h1 className="vt">
            {anyPost
              ? titleFor(mood, selected, index === weeks.length - 1, settle > 0)
              : noNetwork
                ? "How your posts are doing."
                : "Your numbers will appear here."}
          </h1>
          {subtitle && <p className="vs">{subtitle}</p>}
        </div>
        {!noNetwork && (
          <PerformanceConnect
            variant="header"
            connections={overview.connections}
            xMethod={overview.xMethod}
            onConnected={() => void refresh()}
          />
        )}
      </header>

      {error && (
        <p className="err" role="alert" style={{ marginBottom: 16 }}>
          {error}
        </p>
      )}
      {refreshError && (
        <p className="ai-note" role="status" style={{ marginBottom: 16 }}>
          {refreshError}
        </p>
      )}

      {lapsed.length > 0 && (
        <p className="ai-note" role="status" style={{ marginBottom: 16 }}>
          Connection expired for {lapsed.map(platformLabel).join(", ")} — reconnect it with the button above.
        </p>
      )}
      {unavailable.filter((n) => !lapsed.includes(n)).length > 0 && (
        <p className="ai-note" role="status" style={{ marginBottom: 16 }}>
          Stats are not available yet for{" "}
          {unavailable
            .filter((n) => !lapsed.includes(n))
            .map(platformLabel)
            .join(" and ")}
          . The other network is shown as usual.
        </p>
      )}

      {candidates.length > 0 && (
        <div className="pf-card pf-detected" role="group" aria-label="Posts to confirm">
          <h2>
            {candidates.length} {candidates.length === 1 ? "post" : "posts"} spotted —{" "}
            {candidates.length === 1 ? "is this one yours?" : "which are yours?"}
          </h2>
          {candidates.map((c) => (
            <div className="row" key={c.id}>
              <div className="what">
                <b>{c.scriptTitle || "(untitled)"}</b>
                <span>
                  {platformLabel(c.platform)} · {compact(c.metrics.views)} impressions{c.captionText ? ` · ${c.captionText}` : ""}
                </span>
              </div>
              <button className="btn btn-quiet btn-sm" type="button" onClick={() => void resolveCandidate(c.id, "dismiss")}>
                Not mine
              </button>
              <button className="btn btn-ink btn-sm" type="button" onClick={() => void resolveCandidate(c.id, "confirm")}>
                Yes, it is
              </button>
            </div>
          ))}
        </div>
      )}

      {noNetwork ? (
        <PerformanceConnect
          variant="card"
          connections={overview.connections}
          xMethod={overview.xMethod}
          onConnected={() => void refresh()}
        />
      ) : (
        <>
          <section className="pf-top">
            <div className="pf-card pf-hero">
              <div>
                <div className="kick">
                  <AppIcon name="eye" small /> Impressions · {name.toLowerCase()}
                </div>
                <div className="pf-big">
                  <b>{fig(selected.impressions)}</b>
                  <span className="pf-flags">
                    <Delta value={change(selected.impressions, previous?.impressions)} className="pf-pill" />
                    {settle > 0 && (
                      <span
                        className="pf-wait"
                        title="Views keep arriving for a few days after a post goes out: this week's numbers, and the change, will settle."
                      >
                        Wait {settle} {settle === 1 ? "day" : "days"}
                      </span>
                    )}
                  </span>
                </div>
                <div className="pf-split">
                  <b>{fig(selected.byNetwork.linkedin.impressions)}</b> on LinkedIn · <b>{fig(selected.byNetwork.x.impressions)}</b> on X
                </div>
                <div className="pf-sec">
                  {(
                    [
                      ["Likes", "heart", selected.likes, previous?.likes],
                      ["Comments", "comment", selected.comments, previous?.comments],
                      ["Shares", "repeat", selected.shares, previous?.shares],
                    ] as const
                  ).map(([label, icon, value, before]) => (
                    <div key={label}>
                      <span className="k" title={label}>
                        <AppIcon name={icon} />
                        <span className="sr">{label}</span>
                      </span>
                      <b>{fig(value)}</b>
                      <Delta value={change(value, before)} className="d" />
                    </div>
                  ))}
                </div>
              </div>
              <WeekBars weeks={weeks} index={index} onPick={setIndex} empty={empty} />
            </div>

            <BestPost post={best} median={median} waiting={empty} settling={settle > 0} />
          </section>

          <div className="pf-sticky">
            <b>Week of {weekLabel(selected.start)}</b>
            <span className="k">{name}</span>
          </div>

          <section className="pf-card pf-list" ref={listRef}>
            <div className="pf-colh">
              <span />
              <span />
              <span>
                <NetworkLogo network="linkedin" />
              </span>
              <span>
                <NetworkLogo network="x" />
              </span>
            </div>
            {[...weeks.keys()].reverse().map((w) => {
              const inWeek = posts.filter((p) => p.weekStart === weeks[w].start).reverse();
              return (
                <div key={weeks[w].start}>
                  <h3 className={`pf-wk${w === index ? " cur" : ""}`} data-w={w}>
                    <b>{weekLabel(weeks[w].start)}</b>
                    {weekName(w, weeks.length)}
                  </h3>
                  {inWeek.length === 0 ? (
                    <p className="pf-none">{empty ? "No post yet." : "Nothing went out this week."}</p>
                  ) : (
                    inWeek.map((post) => (
                      <PostRow key={post.key} post={post} isBest={w === index && best?.key === post.key} faded={w !== index} />
                    ))
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </>
  );
}

function WeekBars({ weeks, index, onPick, empty }: { weeks: WeekTotals[]; index: number; onPick: (i: number) => void; empty: boolean }) {
  const max = Math.max(1, ...weeks.map((w) => w.impressions));
  return (
    <div className="pf-chart">
      <div className="cap">Impressions per week</div>
      <div className="pf-bars">
        {weeks.map((w, i) => (
          <button
            key={w.start}
            type="button"
            className={`pf-bar${i === index ? " cur" : ""}`}
            aria-label={`Week of ${weekLabel(w.start)}: ${w.impressions} impressions`}
            aria-pressed={i === index}
            onClick={() => onPick(i)}
          >
            <span className="v">{empty || w.posts === 0 ? "—" : compact(w.impressions)}</span>
            <i style={{ height: Math.max(8, (w.impressions / max) * 112) }} />
          </button>
        ))}
      </div>
      <div className="pf-lbl">
        {weeks.map((w, i) => (
          <span key={w.start} className={i === index ? "cur" : undefined}>
            {MONTH_DAY.format(new Date(`${w.start}T00:00:00Z`))}
          </span>
        ))}
      </div>
    </div>
  );
}

function BestPost({
  post,
  median,
  waiting,
  settling,
}: {
  post: OverviewPost | null;
  median: number | null;
  waiting: boolean;
  settling: boolean;
}) {
  if (!post) {
    return (
      <div className="pf-card pf-best pf-best-empty">
        <div className="kick">
          <AppIcon name="star" small /> Best post
        </div>
        <p className="why">
          {waiting
            ? "Your best post shows up here once your first numbers are in."
            : "Nothing went out this week, so there is no best post to show."}
        </p>
      </div>
    );
  }
  // « × your usual reach » of a post a few hours old would only say it is young.
  const ratio = settling ? null : reachRatio(post, median);
  const likes = (post.linkedin?.likes ?? 0) + (post.x?.likes ?? 0);
  return (
    <div className="pf-card pf-best">
      <div className="kick">
        <AppIcon name="star" small /> Best post
      </div>
      <h2>{post.title}</h2>
      <div className="nets">
        {NETWORKS.map((network) => (
          <div key={network}>
            <span className="k">
              <NetworkLogo network={network} />
            </span>
            <b>{post[network] ? compact(post[network]!.impressions) : "—"}</b>
          </div>
        ))}
      </div>
      <p className="why">
        {ratio !== null && <>{ratio}× your usual reach · </>}
        <AppIcon name="heart" small /> {likes}
      </p>
    </div>
  );
}
