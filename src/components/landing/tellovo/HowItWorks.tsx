"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { RefObject } from "react";
import {
  CheckIcon,
  CommentIcon,
  GithubIcon,
  HeartIcon,
  LinearIcon,
  NotesIcon,
  NotionIcon,
  RefreshIcon,
  RepostIcon,
  ThumbIcon,
  TrendIcon,
  XIcon,
} from "@/components/landing/tellovo/icons";
import { isMobile, prefersReducedMotion } from "@/components/landing/tellovo/util";

const TABS = [
  { n: "01", label: "Connect" },
  { n: "02", label: "Learn" },
  { n: "03", label: "Publish" },
  { n: "04", label: "Improve" },
];

const COMMITS = [
  { title: "feat: webhook retries", meta: "#42 · merged · 2h ago", isNew: true },
  { title: "fix: idempotent replays", meta: "#41 · merged · yesterday" },
  { title: "docs: retry policy", meta: "a3f9c1 · 2 days ago", extra: true },
];

const STEPS = [
  { n: "01", title: "Connect your work", body: "Start with your GitHub repo. Add Notion, Linear, or Markdown notes for richer context." },
  {
    n: "02",
    title: "Tellovo learns your business",
    body: "From your work, Tellovo understands your product, your audience, and the problems you're solving.",
  },
  {
    n: "03",
    title: "Get your weekly content plan",
    body: "Each week, Tellovo turns your 3 best stories into X and LinkedIn posts written for your future customers.",
  },
];

type State = { phase: number; hold: boolean };
type Action = { type: "advance" } | { type: "pick"; phase: number } | { type: "follow"; phase: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "advance":
      return { phase: (state.phase + 1) % 4, hold: false };
    case "pick":
      return { phase: action.phase, hold: true };
    case "follow":
      return action.phase === state.phase ? state : { phase: action.phase, hold: false };
  }
}

function Sources({ className }: { className: string }) {
  return (
    <div className={className}>
      <p className="ctx-h">More sources</p>
      <div className="src-row">
        <span className="src">
          <NotionIcon className="src-i" aria-hidden="true" />
          Notion
        </span>
        <span className="src">
          <LinearIcon className="src-i" aria-hidden="true" />
          Linear
        </span>
        <span className="src">
          <NotesIcon className="src-i" aria-hidden="true" />
          Notes
        </span>
      </div>
    </div>
  );
}

function Connector({ className }: { className: string }) {
  return (
    <div className={className} aria-hidden="true">
      <span className="il-line">
        <i />
        <i />
      </span>
    </div>
  );
}

function Core({ small }: { small?: boolean }) {
  return (
    <span className={small ? "core core-sm" : "core"} aria-hidden="true">
      <span className="ring ring-a" />
      <span className="ring ring-b" />
      <span className="core-dot" />
    </span>
  );
}

function Illustration({
  phase,
  hold,
  onPick,
  gridRef,
  railRef,
  railFillRef,
}: {
  phase: number;
  hold: boolean;
  onPick: (phase: number) => void;
  gridRef: RefObject<HTMLDivElement | null>;
  railRef: RefObject<HTMLSpanElement | null>;
  railFillRef: RefObject<HTMLSpanElement | null>;
}) {
  const state = (i: number) => (phase === i ? " is-on" : phase > i ? " is-done" : "");
  return (
    <div
      className={`il rv ph-${phase}${hold ? " hold" : ""}`}
      role="figure"
      aria-label="How Tellovo works: your work and business context feed your Tello Content Engine. It publishes posts that reach your future customers, and every outcome improves the engine — so your business scales."
    >
      <div className="il-grid" ref={gridRef}>
        <span className="il-rail" ref={railRef} aria-hidden="true">
          <span className="il-rail-f" ref={railFillRef} />
        </span>

        <div className={`il-col il-work il-m0${state(0)}`}>
          <p className="il-k">
            <span className="il-ph">Connect your work</span>
            <span className="il-kt">Your work</span>
          </p>
          <div className="il-stack">
            {COMMITS.map((c) => (
              <div key={c.title} className={c.extra ? "cm il-hl0 cm-3" : "cm il-hl0"}>
                <GithubIcon className="gh" aria-hidden="true" />
                <span className="cm-b">
                  <span className="cm-t">{c.title}</span>
                  <span className="cm-m">{c.meta}</span>
                </span>
                {c.isNew && <span className="cm-new" aria-hidden="true" />}
              </div>
            ))}
          </div>
          <Sources className="il-card srcs srcs-m" />
        </div>

        <Connector className="il-link il-l0" />

        <div className={`il-col il-ctx il-m1${state(1)}`}>
          <p className="il-k">
            <span className="il-ph">Learn your business context</span>
            <span className="il-kt">Your business context</span>
          </p>
          <div className="il-card ctx il-hl1">
            <p className="ctx-h">Memory</p>
            <div className="mem">
              <div className="mem-r">
                <span className="mem-l">Product</span>
                <span className="mem-v">Webhook infra for SaaS</span>
              </div>
              <div className="mem-r">
                <span className="mem-l">Audience</span>
                <span className="mem-v">Backend devs · CTOs</span>
              </div>
              <div className="mem-r">
                <span className="mem-l">Problem</span>
                <span className="mem-v">Silent webhook failures</span>
              </div>
            </div>
            <p className="ctx-h ctx-live">
              <span className="live" aria-hidden="true" />
              Continuous data
            </p>
            <div className="kps">
              <span className="kp">
                <span className="kp-l">Signups</span>
                <span className="kp-v">▲ 18%</span>
              </span>
              <span className="kp">
                <span className="kp-l">Trial → paid</span>
                <span className="kp-v">12%</span>
              </span>
              <span className="kp kp-w">
                <span className="kp-l">Experiment</span>
                <span className="kp-v">Usage-based pricing · running</span>
              </span>
            </div>
          </div>
          <Sources className="il-card srcs srcs-d il-hl0" />
        </div>

        <Connector className="il-link il-l1" />

        <div className={`il-col il-eng il-m2${state(2)}`}>
          <p className="il-k">
            <span className="il-ph">Produce your Tello Content Engine</span>
            <span className="il-kt">Your Tello Content Engine</span>
          </p>
          <div className="il-card eng il-hl2 il-hl3">
            <div className="eng-top">
              <Core />
              <span className="eng-tt">
                <span className="eng-t">This week</span>
                <span className="eng-s">3 best stories, each for the audience that converts</span>
              </span>
            </div>
            <ol className="picks">
              <li className="pk">
                <span className="pk-n">1</span>
                <span className="pk-b">
                  <span className="pk-t">Webhook retries</span>
                  <span className="pk-a">→ backend devs</span>
                </span>
              </li>
              <li className="pk">
                <span className="pk-n">2</span>
                <span className="pk-b">
                  <span className="pk-t">Idempotent replays</span>
                  <span className="pk-a">→ CTOs</span>
                </span>
              </li>
              <li className="pk">
                <span className="pk-n">3</span>
                <span className="pk-b">
                  <span className="pk-t">3 months of logs</span>
                  <span className="pk-a">→ founders</span>
                </span>
              </li>
            </ol>
            <div className="learn">
              <p className="ctx-h">
                <RefreshIcon className="ico sm" aria-hidden="true" />
                Learned from last week
              </p>
              <p className="learn-r">“Problem solved” stories get 2× more replies</p>
              <p className="learn-r">CTOs answer on LinkedIn, devs on X</p>
            </div>
          </div>
        </div>

        <Connector className="il-link il-l2" />

        <div className={`il-col il-reach il-m3${state(3)}`}>
          <p className="il-k">
            <span className="il-ph">Reach your future customers</span>
            <span className="il-kt">Your future customers</span>
          </p>
          <div className="pm il-hl2">
            <div className="pm-h">
              <XIcon className="pm-x" aria-hidden="true" />
              <span className="pm-who">You · X</span>
              <span className="pm-up" aria-hidden="true">
                +24
              </span>
            </div>
            <p className="pm-t">Temporary failures shouldn&apos;t mean lost events. We just shipped webhook retries.</p>
            <p className="pm-e">
              <span className="eg">
                <HeartIcon className="eg-i" />
                128
              </span>
              <span className="eg">
                <CommentIcon className="eg-i" />
                18
              </span>
              <span className="eg">
                <RepostIcon className="eg-i" />
                24
              </span>
            </p>
          </div>
          <div className="pm il-hl2">
            <div className="pm-h">
              <span className="pm-li" aria-hidden="true">
                in
              </span>
              <span className="pm-who">You · LinkedIn</span>
              <span className="pm-up pm-up2" aria-hidden="true">
                +41
              </span>
            </div>
            <p className="pm-t">How we stopped losing customer events — and what it taught us about reliability.</p>
            <p className="pm-e">
              <span className="eg">
                <ThumbIcon className="eg-i" />
                212
              </span>
              <span className="eg">
                <CommentIcon className="eg-i" />
                31
              </span>
            </p>
          </div>
          <div className="ib il-hl2 il-hl3">
            <span className="ib-dot" aria-hidden="true" />
            <span className="ib-b">
              <span className="ib-t">New message · Head of Platform</span>
              <span className="ib-q">“Saw your post on retries. Can we book a demo?”</span>
            </span>
          </div>
        </div>

        <Connector className="il-link il-l3 il-mob" />

        <div className={`il-col il-imp il-m4 il-mob${state(4)}`}>
          <p className="il-k">
            <span className="il-ph">Improve your Tello Content Engine</span>
            <span className="il-kt">Your Tello Content Engine</span>
          </p>
          <div className="il-card imp">
            <div className="eng-top">
              <Core small />
              <span className="eng-tt">
                <span className="eng-t">Engine update</span>
                <span className="eng-s">What last week&apos;s posts taught it</span>
              </span>
            </div>
            <p className="ctx-h ub-h">Replies per post, by story type</p>
            <div className="ub">
              <div className="ub-r">
                <span className="ub-l">Problem solved</span>
                <span className="ub-b">
                  <span className="ub-f" style={{ width: "100%" }} />
                </span>
                <span className="ub-v">2.1×</span>
              </div>
              <div className="ub-r">
                <span className="ub-l">Founder insight</span>
                <span className="ub-b">
                  <span className="ub-f" style={{ width: "76%" }} />
                </span>
                <span className="ub-v">1.6×</span>
              </div>
              <div className="ub-r">
                <span className="ub-l">What shipped</span>
                <span className="ub-b">
                  <span className="ub-f" style={{ width: "48%" }} />
                </span>
                <span className="ub-v">1.0×</span>
              </div>
            </div>
            <p className="ctx-h ctx-live">Adjusted for next week</p>
            <ul className="adj">
              {["More “problem solved” stories", "LinkedIn first for CTOs", "Fewer plain release notes"].map((t) => (
                <li key={t} className="adj-i">
                  <span className="adj-c" aria-hidden="true">
                    <CheckIcon className="ico sm" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <p className="lp-m">
            <RefreshIcon className="ico sm" aria-hidden="true" />
            Engagement and leads teach your engine what works
          </p>
        </div>

        <Connector className="il-link il-l4 il-mob" />

        <div className={`il-col il-scale il-m5 il-mob${state(5)}`}>
          <p className="il-k">
            <span className="il-ph">Scale your business</span>
            <span className="il-kt">Your business</span>
          </p>
          <div className="il-card scl">
            <div className="eng-top">
              <span className="scl-ico" aria-hidden="true">
                <TrendIcon className="ico" />
              </span>
              <span className="eng-tt">
                <span className="eng-t">Last 90 days</span>
                <span className="eng-s">What weeks of stories compound into</span>
              </span>
            </div>
            <div className="scl-kpis">
              <div className="scl-k">
                <span className="kp-l">
                  <i className="scl-dot" aria-hidden="true" />
                  MRR
                </span>
                <span className="scl-v">€4.8k</span>
                <span className="scl-d">▲ 3.2×</span>
              </div>
              <div className="scl-k">
                <span className="kp-l">
                  <i className="scl-dot scl-dot-b" aria-hidden="true" />
                  Community
                </span>
                <span className="scl-v">1,240</span>
                <span className="scl-d">▲ +860</span>
              </div>
            </div>
            <svg className="scl-chart" viewBox="0 0 280 96" aria-hidden="true">
              <path className="scl-grid" d="M0 24H280M0 56H280M0 88H280" />
              <path className="scl-area" d="M0 84 C40 82 60 78 90 72 S140 62 170 50 S230 24 280 10 V96 H0Z" />
              <path className="scl-line scl-line-b" pathLength={1} d="M0 76 C50 74 80 70 110 62 S170 52 200 40 S250 30 280 22" />
              <path className="scl-line" pathLength={1} d="M0 84 C40 82 60 78 90 72 S140 62 170 50 S230 24 280 10" />
              <circle className="scl-end" cx="280" cy="10" r="4" />
            </svg>
            <p className="scl-x" aria-hidden="true">
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
            </p>
          </div>
        </div>
      </div>

      <div className="il-loop" aria-hidden="true">
        <div className="lp-wrap">
          <svg className="lp-svg" viewBox="0 0 100 40" preserveAspectRatio="none">
            <path className="lp-path" d="M78.3 0 V20 Q78.3 32 70 32 H32.6 Q24.3 32 24.3 20 V3" />
          </svg>
          <span className="lp-arr" />
          <span className="lp-label">
            <RefreshIcon className="ico sm" />
            Engagement and leads teach your engine what works
          </span>
        </div>
      </div>

      <div className="il-tabs" role="group" aria-label="Walk through the system">
        {TABS.map((t, i) => (
          <button key={t.n} type="button" className={phase === i ? "it on" : "it"} aria-pressed={phase === i} onClick={() => onPick(i)}>
            <span className="it-bar" aria-hidden="true">
              <span className="it-f" />
            </span>
            <span className="it-n">{t.n}</span>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HowItWorks() {
  const [{ phase, hold }, dispatch] = useReducer(reducer, { phase: 0, hold: false });
  const sectionRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const railRef = useRef<HTMLSpanElement | null>(null);
  const railFillRef = useRef<HTMLSpanElement | null>(null);
  const visible = useRef(true);
  const pausedUntil = useRef(0);

  // Desktop: the walkthrough advances by itself every 4.2 s while the section is on screen,
  // and stays put for 9 s after a click on a tab.
  useEffect(() => {
    const section = sectionRef.current;
    let observer: IntersectionObserver | undefined;
    visible.current = true;
    if (section && "IntersectionObserver" in window) {
      visible.current = false;
      observer = new IntersectionObserver(
        (entries) => {
          visible.current = !!entries[entries.length - 1]?.isIntersecting;
        },
        { threshold: 0.25 },
      );
      observer.observe(section);
    }
    if (prefersReducedMotion()) return () => observer?.disconnect();
    const timer = setInterval(() => {
      if (!visible.current || isMobile() || Date.now() < pausedUntil.current) return;
      dispatch({ type: "advance" });
    }, 4200);
    return () => {
      clearInterval(timer);
      observer?.disconnect();
    };
  }, []);

  // Mobile: the scroll drives the phase and fills the rail.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const grid = gridRef.current;
      if (!grid || !isMobile()) return;
      const line = 0.6 * (window.innerHeight || document.documentElement.clientHeight || 800);
      let current = 0;
      grid.querySelectorAll(".il-col > .il-k").forEach((el, i) => {
        if (el.getBoundingClientRect().top <= line) current = i;
      });
      const rail = railRef.current;
      const fill = railFillRef.current;
      if (rail && fill) {
        const rect = rail.getBoundingClientRect();
        const ratio = rect.height ? (line - rect.top) / rect.height : 0;
        fill.style.transform = `scaleY(${Math.max(0, Math.min(1, ratio)).toFixed(4)})`;
      }
      dispatch({ type: "follow", phase: current });
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const pick = useCallback((i: number) => {
    pausedUntil.current = Date.now() + 9000;
    dispatch({ type: "pick", phase: i });
  }, []);

  return (
    <section id="story" ref={sectionRef} className={phase < 3 ? `sec story st-${phase}` : "sec story"} data-nav-dark="true">
      <div className="wrap">
        <div className="rv">
          <h2 className="h2">
            From code to content.
            <br />
            <span className="ul">In three simple steps.</span>
          </h2>
        </div>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className="step rv">
              <span className="n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <Illustration phase={phase} hold={hold} onPick={pick} gridRef={gridRef} railRef={railRef} railFillRef={railFillRef} />
      </div>
    </section>
  );
}
